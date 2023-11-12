#![allow(clippy::all)]
extern crate gl;
extern crate sdl2;

use std::{
    ffi::{c_void, CString},
    mem, ptr,
};

use gl::types::{GLboolean, GLfloat, GLsizeiptr, GLuint};
use sdl2::{event::Event, keyboard::Keycode};

mod shader;
use shader::{Attrib, Program, Shader};

mod stopwatch;
use stopwatch::Stopwatch;

const SCREEN_BOUNDS: (u32, u32) = (900, 900);
static VERTEX_DATA: [GLfloat; 12] = [
    -1.0, 1.0, 0.0,// Top left
    1.0, 1.0, 0.0, // Top right
    1.0, -1.0, 0.0, // Bottom right
    -1.0, -1.0, 0.0// Bottom left
];

#[allow(clippy::cast_precision_loss)]
fn main() -> Result<(), String> {
    // Fix on kde
    std::env::set_var("SDL_VIDEO_X11_NET_WM_BYPASS_COMPOSITOR", "0");

    // Initialize everything
    let sdl_context = sdl2::init()?;
    let video_subsystem = sdl_context.video()?;
    let stopwatch = Stopwatch::new();
    // video_subsystem.display_bounds(0);

    let window = video_subsystem
        .window("Lanternfly abahabba", SCREEN_BOUNDS.0, SCREEN_BOUNDS.1)
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

    // shaders
    let vert = Shader::vertex_from_source("shaders/test.vert")?;
    let frag = Shader::fragment_from_source("shaders/test.frag")?;
    let shader = Program::link("test".to_string(), &[&vert, &frag])?;

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

        // Use shader program
        shader.use_program(|context| {
            context.set_vec2(
                shader.get_uniform("resolution"),
                (SCREEN_BOUNDS.0 as f32, SCREEN_BOUNDS.1 as f32),
            );
            // in case time isnt used i guess?
            let uo = shader.get_uniform_option("time");
            if uo.is_some() {
                context.set_float(
                    uo.unwrap(),
                    stopwatch.elapsed_seconds() as f32
                );
            } 
        });
        gl::BindFragDataLocation(shader.id, 0, CString::new("outcolor").unwrap().as_ptr());

        // Specify the layout of the vertex data
        let pos_attr = gl::GetAttribLocation(shader.id, CString::new("position").unwrap().as_ptr());
        gl::EnableVertexAttribArray(pos_attr as GLuint);
        gl::VertexAttribPointer(
            pos_attr as GLuint,
            3, // Two components per vertex (x, y)
            gl::FLOAT,
            gl::FALSE as GLboolean,
            0, // Stride (0 means tightly packed)
            ptr::null(),
        );
        // gl::Viewport(0, 0, 900, 900);
    }

    

    'mainloop: loop {
        // poll events
        for e in event_pump.poll_iter() {
            match e {
                Event::Quit { .. }
                | Event::KeyDown {
                    keycode: Some(Keycode::Escape),
                    ..
                } => break 'mainloop,

                _ => {}
            }
        }

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
                context.set_float(
                    uo.unwrap(),
                    stopwatch.elapsed_seconds() as f32
                );
            } 
        });

        unsafe {
            gl::BindVertexArray(vao);
            gl::BindBuffer(gl::ARRAY_BUFFER, vbo);

            // No need to unbind VAO here
            // gl::BindVertexArray(0);

            gl::DrawArrays(gl::QUADS, 0, 6);

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
