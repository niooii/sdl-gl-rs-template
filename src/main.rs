extern crate sdl2;
extern crate gl;

use std::ffi::CString;

use sdl2::{event::Event, keyboard::Keycode};

mod shader;
use shader::{Shader, Program, Attrib};

const SCREEN_BOUNDS: (u32, u32) = (1200, 900);

fn main() -> Result<(), String> {
    
    // Fix on kde
    std::env::set_var("SDL_VIDEO_X11_NET_WM_BYPASS_COMPOSITOR", "0");

    // Initialize everything
    let sdl_context = sdl2::init()?;
    let video_subsystem = sdl_context.video()?;
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
    } );

    // shaders
    

    let mut event_pump = sdl_context.event_pump()?;

    'mainloop: loop {
        // poll events
        for e in event_pump.poll_iter() {
            match e {
                Event::Quit { .. } |
                Event::KeyDown { keycode: Some(Keycode::Escape), .. }
                => {break 'mainloop}
                

                
                _ => {}
            }
        }
        
        // drawing
        unsafe {
            gl::ClearColor(0.3, 0.3, 0.3, 1.0);
            gl::Clear(gl::COLOR_BUFFER_BIT);
        }

        window.gl_swap_window();
    }

    

    Ok(())
}
