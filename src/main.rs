#![allow(clippy::all)]
extern crate gl;
extern crate sdl2;

use std::{
    ffi::{c_void, CString},
    mem, ptr,
};

mod vec3;
use vec3::Vec3;

mod camera;
use camera::Camera;

use gl::types::{GLboolean, GLfloat, GLsizeiptr, GLuint};
use sdl2::{
    event::Event,
    keyboard::{Keycode, Scancode},
};

mod shader;
use shader::{Attrib, Program, Shader};

mod stopwatch;
use stopwatch::Stopwatch;

const SCREEN_BOUNDS: (u32, u32) = (900, 900);
const SENSITIVITY: f32 = 0.01;
static VERTEX_DATA: [GLfloat; 12] = [
    -1.0, 1.0, 0.0, // Top left
    1.0, 1.0, 0.0, // Top right
    1.0, -1.0, 0.0, // Bottom right
    -1.0, -1.0, 0.0, // Bottom left
];

#[allow(clippy::cast_precision_loss, clippy::too_many_lines)]
fn main() -> Result<(), String> {
    // Fix on kde
    std::env::set_var("SDL_VIDEO_X11_NET_WM_BYPASS_COMPOSITOR", "0");

    // Initialize everything
    let sdl_context = sdl2::init()?;
    let video_subsystem = sdl_context.video()?;
    let stopwatch = Stopwatch::new();
    // video_subsystem.display_bounds(0);

    let mut window = video_subsystem
        .window("Shader Window", SCREEN_BOUNDS.0, SCREEN_BOUNDS.1)
        .position_centered()
        .opengl()
        // .resizable()
        .build()
        .map_err(|e| e.to_string())?;

    let gl_context = window.gl_create_context()?;
    window.gl_make_current(&gl_context)?;

    gl::load_with(|s| unsafe {
        let c_str = CString::new(s).unwrap();
        sdl2::sys::SDL_GL_GetProcAddress(c_str.as_ptr())
    });

    let mut event_pump = sdl_context.event_pump()?;

    // some boilerplate for gl
    let mut vao = 0;
    let mut vbo = 0;

    unsafe {
        // Create Vertex Array Object
        gl::GenVertexArrays(1, &mut vao);
        gl::BindVertexArray(vao);

        // Create a Vertex Buffer Object and copy the vertex data to it
        gl::GenBuffers(1, &mut vbo);
        gl::BindBuffer(gl::ARRAY_BUFFER, vbo);
        gl::BufferData(
            gl::ARRAY_BUFFER,
            (VERTEX_DATA.len() * mem::size_of::<GLfloat>()) as GLsizeiptr,
            mem::transmute(&VERTEX_DATA[0]),
            gl::STATIC_DRAW,
        );

        // gl::Viewport(0, 0, 900, 900);
    }

    // shaders
    let vert = Shader::vertex_from_source("shaders/test.vert")?;
    let frag = Shader::fragment_from_source("shaders/sphere_torus_original.frag")?;
    let s = {
        let mut v = Vec::<Shader>::new();
        v.push(vert);
        v.push(frag);
        v
    };
    let mut shader = Program::link("hehehehaw".to_string(), "outcolor", s)?;

    let mut camera_pos = Vec3::new(0.0, 0.0, -2.0);
    let mut camera_rotation = Vec3::zero();
    let mut movevec = Vec3::new(0.0, 0.0, 1.0);

    window.set_grab(true);
    sdl_context.mouse().show_cursor(false);

    'mainloop: loop {
        // poll events
        for e in event_pump.poll_iter() {
            match e {
                Event::Quit { .. } => break 'mainloop,
                Event::KeyDown { keycode, .. } => match keycode.unwrap() {
                    Keycode::R => {
                        shader = shader.reload()?;
                        camera_pos = Vec3::new(0.0, 0.0, -2.0);
                    }
                    _ => {}
                },
                Event::MouseMotion { xrel, yrel, .. } => {
                    camera_rotation.add_y(xrel as f32 * SENSITIVITY);
                    camera_rotation.add_z(yrel as f32 * SENSITIVITY);
                    sdl_context.mouse().warp_mouse_in_window(
                        &window,
                        (SCREEN_BOUNDS.0 / 2) as i32,
                        (SCREEN_BOUNDS.1 / 2) as i32,
                    );
                }
                _ => {}
            }
        }

        let ks = event_pump.keyboard_state();

        if ks.is_scancode_pressed(Scancode::W) {
            camera_pos.add_z(0.1);
        }
        if ks.is_scancode_pressed(Scancode::A) {
            camera_pos.add_x(-0.1);
        }
        if ks.is_scancode_pressed(Scancode::S) {
            camera_pos.add_z(-0.1);
        }
        if ks.is_scancode_pressed(Scancode::D) {
            camera_pos.add_x(0.1);
        }
        if ks.is_scancode_pressed(Scancode::Space) {
            camera_pos.add_y(0.1);
        }
        if ks.is_scancode_pressed(Scancode::LShift) {
            camera_pos.add_y(-0.1);
        }

        // cameraPos.z += 0.03;

        // drawing
        unsafe {
            gl::ClearColor(0.3, 0.3, 0.3, 1.0);
            gl::Clear(gl::COLOR_BUFFER_BIT);
        }

        // Use shader program
        shader.use_program(|context| {
            context.set_vec2(
                shader.get_uniform("resolution"),
                (SCREEN_BOUNDS.0 as f32, SCREEN_BOUNDS.1 as f32),
            );
            // in case time isnt used i guess?
            let uo = shader.get_uniform_option("time");
            if uo.is_some() {
                context.set_float(uo.unwrap(), 0.4 * (stopwatch.elapsed_seconds() as f32));
            }

            context.set_vec3(
                shader.get_uniform("cameraPos"),
                (camera_pos.x(), camera_pos.y(), camera_pos.z()),
            );
            context.set_vec3(shader.get_uniform("rot"), (camera_rotation.x(), camera_rotation.y(), camera_rotation.z()));
            // context.set_vec3(shader.get_uniform("rot"), (0_f32, 0_f32, stopwatch.elapsed_seconds() as f32));
        });

        unsafe {
            gl::BindVertexArray(vao);
            gl::BindBuffer(gl::ARRAY_BUFFER, vbo);

            // No need to unbind VAO here
            // gl::BindVertexArray(0);

            gl::DrawArrays(gl::QUADS, 0, 12);

            // Unbind VAO after drawing
            gl::BindVertexArray(0);

            let error = gl::GetError();
            if error != gl::NO_ERROR {
                println!("OpenGL Error: {}", error);
            }
        }

        window.gl_swap_window();

        // let error_string = unsafe {
        //     let err_code = gl::GetError();
        //     let err_str = CString::from_raw(gl::GetString(err_code) as *mut i8);
        //     let s = err_str.to_str();
        //     s.unwrap_or("unknown bruh").to_string()
        // };

        // println!("OpenGL Error: {}", error_string);
    }

    Ok(())
}
