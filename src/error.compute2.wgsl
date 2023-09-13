@binding(0) @group(0) var source: texture_2d<f32>;
@binding(1) @group(0) var current: texture_2d<f32>;
@binding(2) @group(0) var<storage, read_write> error: array<f32>;

@compute
@workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) grid: vec3<u32>) {
    let a: vec4<f32> = textureLoad(source, grid.xy, 1);
    let b: vec4<f32> = textureLoad(current, grid.xy, 1);
    let diff: vec3<f32> = (a.xyz - b.xyz) * 255;
    error[grid.y * textureDimensions(source).x + grid.x] = sqrt(dot(diff, diff));
}