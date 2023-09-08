@binding(0) @group(0) var source: texture_2d<f32>;
@binding(1) @group(0) var current: texture_2d<f32>;
@binding(2) @group(0) var error: texture_storage_2d<rgba32float, write>;

@compute
@workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) grid: vec3<u32>) {
    textureStore(error, grid.xy, textureLoad(source, grid.xy, 1) - textureLoad(current, grid.xy, 1));
}