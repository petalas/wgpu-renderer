use log::info;
use model::drawing::Drawing;
use std::borrow::Cow;
use std::mem::{self};
use texture::Texture;
use util::BufferDimensions;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;
use wgpu::{vertex_attr_array, BlendState};

use crate::entrypoints::draw_without_gpu;
use crate::model::settings::{MAX_ERROR_PER_PIXEL, PER_POINT_MULTIPLIER};
use crate::util::{calculate_error_from_gpu, draw_on_canvas_internal, get_bytes};
mod entrypoints;
mod model;
mod texture;
mod util;

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Vertex {
    position: [f32; 4],
    color: [f32; 4],
}

#[wasm_bindgen()]
pub struct Engine {
    width: usize,
    height: usize,
    device: wgpu::Device,
    queue: wgpu::Queue,
    buffer_dimensions: BufferDimensions,
    drawing_output_buffer: wgpu::Buffer,
    texture_extent: wgpu::Extent3d,
    texture_format: wgpu::TextureFormat,
    drawing_texture: wgpu::Texture,
    render_pipeline: wgpu::RenderPipeline,
    compute_bind_group: wgpu::BindGroup,
    compute_pipeline: wgpu::ComputePipeline,
    error_output_buffer: wgpu::Buffer,
    error_output_texture: wgpu::Texture,
    running: bool,
    best_drawing: Drawing,
    best_drawing_bytes: Vec<u8>,
}

#[wasm_bindgen()]
impl Engine {
    pub fn toggle_pause(&mut self) {
        self.running = !self.running;
    }

    pub async fn new(
        source_bytes: Vec<u8>,
        best_drawing: JsValue,
        width: usize,
        height: usize,
    ) -> Self {
        let running = false;

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
        let drawing_output_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: (buffer_dimensions.padded_bytes_per_row * buffer_dimensions.height) as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let error_output_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: (buffer_dimensions.padded_bytes_per_row * buffer_dimensions.height) as u64 * 4,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let texture_extent = wgpu::Extent3d {
            width: buffer_dimensions.width as u32,
            height: buffer_dimensions.height as u32,
            depth_or_array_layers: 1,
        };

        let texture_format = wgpu::TextureFormat::Rgba8Unorm;

        // The render pipeline renders data into this texture
        let drawing_texture = device.create_texture(&wgpu::TextureDescriptor {
            size: texture_extent,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: texture_format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT
                | wgpu::TextureUsages::COPY_SRC
                | wgpu::TextureUsages::TEXTURE_BINDING,
            label: None,
            view_formats: &[],
        });
        let view = drawing_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let compute_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0, // 'source' bytes loaded from target image
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Texture {
                            multisampled: false,
                            view_dimension: wgpu::TextureViewDimension::D2,
                            sample_type: wgpu::TextureSampleType::Float { filterable: false },
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 1, // 'current' render target for drawing
                        visibility: wgpu::ShaderStages::COMPUTE | wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::Texture {
                            multisampled: false,
                            view_dimension: wgpu::TextureViewDimension::D2,
                            sample_type: wgpu::TextureSampleType::Float { filterable: false },
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 2, // 'error' output <-- error=abs(source - current) in RGBA32Float
                        visibility: wgpu::ShaderStages::COMPUTE,
                        ty: wgpu::BindingType::StorageTexture {
                            access: wgpu::StorageTextureAccess::WriteOnly,
                            format: wgpu::TextureFormat::Rgba32Float,
                            view_dimension: wgpu::TextureViewDimension::D2,
                        },
                        count: None,
                    },
                ],
                label: Some("compute_bind_group_layout"),
            });

        // doubt this makes much sense, attempting to pass in the dimensions as a 1x2 R32Uint texture
        let dimensions = (width as u32, height as u32);
        // let dimensions_texture = Texture::from_dimensions(&device, &queue, dimensions).unwrap();

        let source_texture = Texture::from_bytes(
            &device,
            &queue,
            &source_bytes.as_slice(),
            dimensions,
            &"source",
        )
        .unwrap();

        let error_output_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("error_output_texture"),
            size: texture_extent,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba32Float,
            usage: wgpu::TextureUsages::COPY_DST
                | wgpu::TextureUsages::COPY_SRC
                | wgpu::TextureUsages::STORAGE_BINDING,
            view_formats: &[],
        });
        let error_texture_view =
            error_output_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let compute_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &compute_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    // source image texture WxH Rgba8Unorm
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&source_texture.view),
                },
                wgpu::BindGroupEntry {
                    // render target texture WxH Rgba8Unorm
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    // error calc output texture WxH Rgba8Unorm
                    binding: 2,
                    resource: wgpu::BindingResource::TextureView(&error_texture_view),
                },
            ],
            label: Some("compute_bind_group"),
        });

        let render_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                bind_group_layouts: &[],
                push_constant_ranges: &[],
            });

        // Load the shaders from disk
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: None,
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("shader.wgsl"))),
        });

        let vertex_buffer_layout = wgpu::VertexBufferLayout {
            array_stride: (mem::size_of::<f32>() * 8) as u64,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &vertex_attr_array![0 => Float32x4, 1 => Float32x4],
        };

        let mut primitive = wgpu::PrimitiveState::default();
        primitive.cull_mode = None;

        let blend_state: BlendState = BlendState {
            color: wgpu::BlendComponent {
                src_factor: wgpu::BlendFactor::SrcAlpha,
                dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
                operation: wgpu::BlendOperation::Add,
            },
            alpha: wgpu::BlendComponent {
                src_factor: wgpu::BlendFactor::One,
                dst_factor: wgpu::BlendFactor::One,
                operation: wgpu::BlendOperation::Max,
            },
        };

        let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: None,
            layout: Some(&render_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: "vs_main",
                buffers: &[vertex_buffer_layout],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: "fs_main",
                targets: &[Some(wgpu::ColorTargetState {
                    format: texture_format,
                    blend: Some(blend_state),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: primitive,
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
        });

        let compute_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("compute_pipeline_layout"),
                bind_group_layouts: &[&compute_bind_group_layout],
                push_constant_ranges: &[],
            });

        let compute_module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: None,
            source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("error.compute.wgsl"))),
        });

        let compute_pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: None,
            layout: Some(&compute_pipeline_layout),
            module: &compute_module,
            entry_point: "main",
        });

        // test draw source_bytes to canvas to check if they look the same as source image
        // draw_on_canvas_internal(&source_bytes, "ref-canvas").await;

        let best_drawing: Drawing = match best_drawing.is_falsy() {
            true => Drawing::new_random(),
            false => Drawing::from(best_drawing),
        };

        let best_drawing_bytes: Vec<u8> = vec![]; // can only set after drawing in post_init

        Engine {
            width,
            height,
            device,
            queue,
            buffer_dimensions,
            drawing_output_buffer,
            texture_extent,
            texture_format,
            drawing_texture,
            render_pipeline,
            compute_bind_group,
            compute_pipeline,
            error_output_buffer,
            error_output_texture,
            running,
            best_drawing,
            best_drawing_bytes,
        }
    }

    async fn draw(&self, drawing: &Drawing) {
        let vertices: Vec<Vertex> = drawing.to_vertices();

        // create buffer, write buffer (bytemuck?)
        let vertex_buffer = wgpu::util::DeviceExt::create_buffer_init(
            &self.device,
            &wgpu::util::BufferInitDescriptor {
                label: Some("Vertex Buffer"),
                contents: bytemuck::cast_slice(&vertices),
                usage: wgpu::BufferUsages::VERTEX,
            },
        );

        let command_buffer: wgpu::CommandBuffer = {
            let mut encoder = self
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });

            let view = &self
                .drawing_texture
                .create_view(&wgpu::TextureViewDescriptor::default());

            // Set the background to be white
            let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: None,
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::WHITE), // WHY DOES DRAWING WHITE TRIANGLES ON TOP OF THIS DO ANYTHING?
                        store: true,
                    },
                })],
                depth_stencil_attachment: None,
            });

            rpass.set_pipeline(&self.render_pipeline);
            // rpass.set_bind_group(0, &self.bind_group, &[]);
            rpass.set_vertex_buffer(0, vertex_buffer.slice(..));
            rpass.draw(0..vertices.len() as u32, 0..vertices.len() as u32);

            // encoder methods like begin_render_pass and copy_texture_to_buffer take a &'pass mut self
            // drop rpass before copy_texture_to_buffer to avoid: cannot borrow `encoder` as mutable more than once at a time
            drop(rpass);

            // Copy the data from the texture to the buffer
            encoder.copy_texture_to_buffer(
                self.drawing_texture.as_image_copy(),
                wgpu::ImageCopyBuffer {
                    buffer: &self.drawing_output_buffer,
                    layout: wgpu::ImageDataLayout {
                        offset: 0,
                        bytes_per_row: Some(self.buffer_dimensions.padded_bytes_per_row as u32),
                        rows_per_image: None,
                    },
                },
                self.texture_extent,
            );

            encoder.finish()
        };

        self.queue.submit(Some(command_buffer));
    }

    async fn calculate_error(&self, width: u32, height: u32) -> wgpu::SubmissionIndex {
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("calculate_error_command_encoder"),
            });

        let mut cpass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
            label: Some("Compute Pass"),
        });
        cpass.set_pipeline(&self.compute_pipeline);
        cpass.set_bind_group(0, &self.compute_bind_group, &[]);
        cpass.dispatch_workgroups(width / 8, height / 8, 1); // compute shader workgroup_size is (8, 8, 1)
        drop(cpass);

        let bytes_per_row = self.buffer_dimensions.padded_bytes_per_row as u32 * 4;
        // log::info!("bytes_per_row: {}", bytes_per_row);

        // Copy the data from the texture to the buffer
        encoder.copy_texture_to_buffer(
            self.error_output_texture.as_image_copy(),
            wgpu::ImageCopyBuffer {
                buffer: &self.error_output_buffer,
                layout: wgpu::ImageDataLayout {
                    offset: 0,
                    bytes_per_row: Some(bytes_per_row),
                    rows_per_image: None,
                },
            },
            self.texture_extent,
        );

        self.queue.submit(Some(encoder.finish()))
    }

    async fn evaluate_drawing(&self, drawing: &Drawing) -> (f64, f64) {
        // step 1 - render pipeline --> draw our triangles to a texture
        self.draw(&drawing).await;

        // Step 2 - compute pipeline --> diff drawing texture vs source texture
        self.calculate_error(self.width as u32, self.height as u32)
            .await;

        // Step 3 - sum output of compute pipeline // TODO: reduction on GPU
        let error_bytes = get_bytes(&self.error_output_buffer).await;
        let error = calculate_error_from_gpu(error_bytes);
        let max_total_error: f64 = MAX_ERROR_PER_PIXEL * self.width as f64 * self.height as f64;
        let mut fitness: f64 = 100.0 * (1.0 - error / max_total_error);
        let penalty = fitness * PER_POINT_MULTIPLIER * drawing.num_points() as f64;
        fitness -= penalty;
        (error, fitness)
    }

    async fn mutate_new_best(&self, mut drawing: Drawing) -> Drawing {
        let current_best = drawing.fitness;
        let mut c1;
        let mut c2: i32 = 0;
        // log::info!("Current fitness = {}", current_best);
        while drawing.fitness <= current_best {
            drawing.is_dirty = false;
            c1 = 0;
            while !drawing.is_dirty {
                // it's possible it won't be mutated at all since all mutations have low probability
                drawing.mutate();
                c1 += 1; // for one mutation
                c2 += 1; // total
                if c1 >= 100 && c1 % 100 == 0 {
                    info!("Taking over {} attempts to get a new mutation.", c1);
                }
                if c2 >= 100 && c2 % 1000 == 0 {
                    info!("Taking over {} attempts to get a new best.", c2);
                }
            }
            drawing.fitness = (self.evaluate_drawing(&drawing).await).1;
        }
        if c2 > 100 {
            info!("took {} attempts to get a new best", c2);
        }
        drawing
    }

    pub async fn post_init(&mut self) {
        // even if it was already set evaluate it again, could be coming in from a different rendering engine
        let (error, fitness) = self.evaluate_drawing(&self.best_drawing).await;
        log::info!("error = {}, fitness = {}", error, fitness);

        self.best_drawing.fitness = fitness;
        self.best_drawing_bytes = get_bytes(&self.drawing_output_buffer).await;
    }

    pub async fn display_best_drawing(&self, canvas_id: &str) {
        draw_on_canvas_internal(&self.best_drawing_bytes, &canvas_id).await;
    }

    pub async fn loop_n_times(&mut self, n: usize, canvas_id: &str) {
        // even if it was already set evaluate it again, could be coming in from a different rendering engine
        let (error, fitness) = self.evaluate_drawing(&self.best_drawing).await;
        self.best_drawing.fitness = fitness;
        log::info!("error = {}, fitness = {}", error, fitness);

        let display_best = canvas_id.len() > 0;

        for i in 0..n {
            self.best_drawing = self.mutate_new_best(self.best_drawing.clone()).await;
            self.best_drawing_bytes = get_bytes(&self.drawing_output_buffer).await;
            log::info!("{} --> fitness = {}", i, self.best_drawing.fitness);

            // also draw non wgpu version on test canvas for comparison
            // draw_without_gpu(
            //     JsValue::from_str(&serde_json::to_string(&self.best_drawing).unwrap()), // normally called from JS side
            //     "ref-canvas",
            // );
        }

        if display_best {
            // TODO: don't await here
            self.display_best_drawing(&canvas_id).await;
        }
    }
}
