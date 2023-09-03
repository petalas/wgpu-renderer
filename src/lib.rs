use log::info;
use std::mem::size_of;
use std::{borrow::Cow, env};
use wasm_bindgen::prelude::wasm_bindgen;
use web_sys::console::info;
use wgpu::{Buffer, CommandEncoder, Device, RenderPass, SubmissionIndex};

use crate::util::{draw_buffer, get_canvas_by_id, resize_canvas};
mod model;
mod util;

async fn run() {
    let args: Vec<_> = env::args().collect();
    let (width, height) = match args.len() {
        // 0 on wasm, 1 on desktop
        0 | 1 => (256usize, 256usize),
        3 => (args[1].parse().unwrap(), args[2].parse().unwrap()),
        _ => {
            println!("Incorrect number of arguments, possible usages:");
            println!("*   0 arguments - uses default width and height of (256, 256)");
            println!("*   2 arguments - uses specified width and height values");
            return;
        }
    };
    let (device, buffer, buffer_dimensions, submission_index) =
        create_red_image_with_dimensions(width, height).await;

    let bytes = get_bytes(buffer).await;

    let canvas = get_canvas_by_id("wgpu-canvas");
    // resize_canvas(&canvas, 256, 256);
    draw_buffer(&bytes, &canvas);
}

async fn create_red_image_with_dimensions(
    width: usize,
    height: usize,
) -> (Device, Buffer, BufferDimensions, SubmissionIndex) {
    let backends = wgpu::util::backend_bits_from_env().unwrap_or_else(wgpu::Backends::all);
    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
        backends,
        dx12_shader_compiler: wgpu::Dx12Compiler::default(),
    });

    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions::default())
        .await
        .unwrap();

    let (device, queue) = adapter
        .request_device(
            &wgpu::DeviceDescriptor {
                label: None,
                features: wgpu::Features::empty(),
                limits: wgpu::Limits::downlevel_defaults(),
            },
            None,
        )
        .await
        .unwrap();

    // It is a WebGPU requirement that ImageCopyBuffer.layout.bytes_per_row % wgpu::COPY_BYTES_PER_ROW_ALIGNMENT == 0
    // So we calculate padded_bytes_per_row by rounding unpadded_bytes_per_row
    // up to the next multiple of wgpu::COPY_BYTES_PER_ROW_ALIGNMENT.
    // https://en.wikipedia.org/wiki/Data_structure_alignment#Computing_padding
    let buffer_dimensions = BufferDimensions::new(width, height);
    // The output buffer lets us retrieve the data as an array
    let output_buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: None,
        size: (buffer_dimensions.padded_bytes_per_row * buffer_dimensions.height) as u64,
        usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });

    let texture_extent = wgpu::Extent3d {
        width: buffer_dimensions.width as u32,
        height: buffer_dimensions.height as u32,
        depth_or_array_layers: 1,
    };

    // The render pipeline renders data into this texture
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        size: texture_extent,
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8UnormSrgb,
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
        label: None,
        view_formats: &[],
    });

    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: None,
        bind_group_layouts: &[],
        push_constant_ranges: &[],
    });

    // Load the shaders from disk
    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: None,
        source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("shader.wgsl"))),
    });

    let config = wgpu::SurfaceConfiguration {
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
        format: wgpu::TextureFormat::Rgba8UnormSrgb,
        width: width as u32,
        height: height as u32,
        present_mode: wgpu::PresentMode::Immediate,
        alpha_mode: wgpu::CompositeAlphaMode::Auto,
        view_formats: vec![],
    };

    let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: None,
        layout: Some(&pipeline_layout),
        vertex: wgpu::VertexState {
            module: &shader,
            entry_point: "vs_main",
            buffers: &[],
        },
        fragment: Some(wgpu::FragmentState {
            module: &shader,
            entry_point: "fs_main",
            targets: &[Some(wgpu::ColorTargetState {
                format: config.format,
                blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                write_mask: wgpu::ColorWrites::ALL,
            })],
        }),
        primitive: wgpu::PrimitiveState::default(),
        depth_stencil: None,
        multisample: wgpu::MultisampleState::default(),
        multiview: None,
    });

    let command_buffer: wgpu::CommandBuffer = {
        let mut encoder =
            device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });

        let view = &texture.create_view(&wgpu::TextureViewDescriptor::default());

        // Set the background to be red
        let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::WHITE),
                    store: true,
                },
            })],
            depth_stencil_attachment: None,
        });

        rpass.set_pipeline(&render_pipeline);
        rpass.draw(0..3, 0..1);

        // encoder methods like begin_render_pass and copy_texture_to_buffer take a &'pass mut self
        // drop rpass before copy_texture_to_buffer to avoid: cannot borrow `encoder` as mutable more than once at a time
        drop(rpass);

        // Copy the data from the texture to the buffer
        encoder.copy_texture_to_buffer(
            texture.as_image_copy(),
            wgpu::ImageCopyBuffer {
                buffer: &output_buffer,
                layout: wgpu::ImageDataLayout {
                    offset: 0,
                    bytes_per_row: Some(buffer_dimensions.padded_bytes_per_row as u32),
                    rows_per_image: None,
                },
            },
            texture_extent,
        );

        encoder.finish()
    };

    let index = queue.submit(Some(command_buffer));
    (device, output_buffer, buffer_dimensions, index)
}

async fn get_bytes(output_buffer: Buffer) -> Vec<u8> {
    // Note that we're not calling `.await` here.
    let buffer_slice = output_buffer.slice(..);
    // Sets the buffer up for mapping, sending over the result of the mapping back to us when it is finished.
    let (sender, receiver) = futures_intrusive::channel::shared::oneshot_channel();
    buffer_slice.map_async(wgpu::MapMode::Read, move |v| sender.send(v).unwrap());

    if let Some(Ok(())) = receiver.receive().await {
        let padded_buffer = buffer_slice.get_mapped_range();
        return padded_buffer.to_vec();
    } else {
        return vec![];
    }
}

struct BufferDimensions {
    width: usize,
    height: usize,
    unpadded_bytes_per_row: usize,
    padded_bytes_per_row: usize,
}

impl BufferDimensions {
    fn new(width: usize, height: usize) -> Self {
        let bytes_per_pixel = size_of::<u32>();
        let unpadded_bytes_per_row = width * bytes_per_pixel;
        let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT as usize;
        let padded_bytes_per_row_padding = (align - unpadded_bytes_per_row % align) % align;
        let padded_bytes_per_row = unpadded_bytes_per_row + padded_bytes_per_row_padding;
        Self {
            width,
            height,
            unpadded_bytes_per_row,
            padded_bytes_per_row,
        }
    }
}

#[wasm_bindgen(start)]
pub fn main() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    console_log::init_with_level(log::Level::Debug).expect("could not initialize logger");
    wasm_bindgen_futures::spawn_local(run());
}
