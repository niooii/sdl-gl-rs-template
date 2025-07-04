use gl;
use gl::types::{GLint, GLuint, GLboolean};
use std::ffi::CString;
/// from <https://github.com/nukep/rust-opengl-util/blob/master/shader.rs>
use std::{fs, ptr};

#[derive(Copy, Clone)]
pub struct Attrib {
    pub id: GLuint,
}

/// Encapsulates an OpenGL shader.
///
/// The shader may be a vertex or fragment shader.
pub struct Shader {
    pub id: GLuint,
    pub src: String,
    pub shader_type: GLuint,
}
impl Drop for Shader {
    /// Deletes the shader (`glDeleteShader()`)
    fn drop(&mut self) {
        unsafe { gl::DeleteShader(self.id) };
    }
}

fn load_source(path: &str) -> String {
    fs::read_to_string(path).unwrap_or_else(|e| {
        let p_str = format!("Failed read of file {path}");
        panic!("{p_str}");
    })
}

impl Shader {
    /// Compiles a vertex shader from source.
    pub fn vertex_from_source(path: &str) -> Result<Shader, String> {
        Shader::from_source(path, gl::VERTEX_SHADER)
    }

    /// Compiles a fragment shader from source.
    pub fn fragment_from_source(path: &str) -> Result<Shader, String> {
        Shader::from_source(path, gl::FRAGMENT_SHADER)
    }

    fn from_source(path: &str, shader_type: GLuint) -> Result<Shader, String> {
        let s = load_source(path);
        let source = s.as_str();
        let shader = Shader {
            id: unsafe { gl::CreateShader(shader_type) },
            src: path.to_string(),
            shader_type
        };
        unsafe {
            let ptr: *const u8 = source.as_bytes().as_ptr();
            let ptr_i8: *const i8 = std::mem::transmute(ptr);
            let len = source.len() as GLint;
            gl::ShaderSource(shader.id, 1, &ptr_i8, &len);
        }

        let successful = unsafe {
            gl::CompileShader(shader.id);

            let mut result: GLint = 0;
            gl::GetShaderiv(shader.id, gl::COMPILE_STATUS, &mut result);
            result != 0
        };

        if successful {
            Ok(shader)
        } else {
            let s_str = match shader_type {
                gl::VERTEX_SHADER => "vertex",
                gl::FRAGMENT_SHADER => "fragment",
                _ => "unknown shader.",
            };
            Err(format!(
                "While compiling {s_str} {}",
                shader.get_compilation_log()
            ))
        }
    }

    fn recompile(&mut self) -> Result<Shader, String> {
        let src = self.src.clone();
        let shader_type = self.shader_type;

        drop(self);

        match shader_type {
            gl::VERTEX_SHADER => {
                return Shader::vertex_from_source(src.as_str());
            },
            gl::FRAGMENT_SHADER => {
                return Shader::fragment_from_source(src.as_str());
            }
            _ => { return Err("Unexpected shader type.".to_string()) }
        }
    }

    fn get_compilation_log(&self) -> String {
        let mut len = 0;
        unsafe { gl::GetShaderiv(self.id, gl::INFO_LOG_LENGTH, &mut len) };
        assert!(len > 0);

        let mut buf = Vec::with_capacity(len as usize);
        let buf_ptr = buf.as_mut_ptr() as *mut gl::types::GLchar;
        unsafe {
            gl::GetShaderInfoLog(self.id, len, std::ptr::null_mut(), buf_ptr);
            buf.set_len(len as usize);
        };

        match String::from_utf8(buf) {
            Ok(log) => log,
            Err(vec) => panic!("Could not convert compilation log from buffer: {}", vec),
        }
    }
}

/// Encapsulates an OpenGL shader program.
pub struct Program {
    pub name: String,
    pub id: GLuint,
    pub shaders: Vec<Shader>
}
impl Drop for Program {
    /// Deletes the program (`glDeleteProgram()`)
    fn drop(&mut self) {
        unsafe { gl::DeleteProgram(self.id) };
    }
}
impl Program {
    pub fn reload(&mut self) -> Result<Program, String>  {
        let new_shaders = self.shaders.iter_mut()
        .map(|s| {
            s.recompile().expect("failed to recompile shader.")
        })
        .collect::<Vec<Shader>>();

        unsafe {
            gl::DeleteProgram(self.id);
        }

        Program::link(self.name.clone(), "outcolor", new_shaders)

    }
    /// Links a new program with the provided shaders.
    ///
    /// Uses `glAttachShader()` and `glLinkProgram()`
    pub fn link(name: String, output_color_var: &str, shaders: Vec<Shader>) -> Result<Program, String> {
        let mut program = Program {
            name: name,
            id: unsafe { gl::CreateProgram() },
            shaders: {
                Vec::new()
            }
        };

        let successful: bool;

        unsafe {
            for shader in shaders {
                gl::AttachShader(program.id, shader.id);
                program.shaders.push(shader);
            }
            gl::LinkProgram(program.id);

            successful = {
                let mut result: GLint = 0;
                gl::GetProgramiv(program.id, gl::LINK_STATUS, &mut result);
                result != 0
            };
            
        }

        if successful {
            unsafe {
                // do some magic shader linking stuff
                gl::BindFragDataLocation(program.id, 0, CString::new(output_color_var).unwrap().as_ptr());

                // Specify the layout of the vertex data
                let pos_attr = gl::GetAttribLocation(program.id, CString::new("position").unwrap().as_ptr());
                gl::EnableVertexAttribArray(pos_attr as GLuint);
                gl::VertexAttribPointer(
                    pos_attr as GLuint,
                    3, // Two components per vertex (x, y)
                    gl::FLOAT,
                    gl::FALSE as GLboolean,
                    0, // Stride (0 means tightly packed)
                    ptr::null(),
                );
            }
            Ok(program)
        } else {
            Err(program.get_link_log())
        }
    }

    /// Calls `glUseProgram()` and then calls the `cb` closure, which is
    /// sent a context for assigning program uniforms.
    pub fn use_program<F>(&self, cb: F)
    where
        F: FnOnce(ProgramUniformContext),
    {
        unsafe { gl::UseProgram(self.id) };
        cb(ProgramUniformContext);
    }

    pub fn get_attrib(&self, name: &str) -> Attrib {
        let c_name = CString::new(name).unwrap();
        let ptr = c_name.as_ptr();
        match unsafe { gl::GetAttribLocation(self.id, ptr) } {
            -1 => panic!(
                "Could not find attribute \"{}\" in shader program \"{}\"",
                name, self.name
            ),
            attr => Attrib { id: attr as GLuint },
        }
    }

    pub fn get_uniform(&self, name: &str) -> Uniform {
        match self.get_uniform_option(name) {
            Some(uniform) => uniform,
            None => panic!(
                "Could not find uniform \"{}\" in shader program \"{}\"",
                name, self.name
            ),
        }
    }

    pub fn get_uniform_option(&self, name: &str) -> Option<Uniform> {
        let c_name = CString::new(name).unwrap();
        let ptr = c_name.as_ptr();
        match unsafe { gl::GetUniformLocation(self.id, ptr) } {
            -1 => None,
            id => Some(Uniform { id: id }),
        }
    }

    pub fn get_link_log(&self) -> String {
        let mut len = 0;
        unsafe { gl::GetProgramiv(self.id, gl::INFO_LOG_LENGTH, &mut len) };
        assert!(len > 0);

        let mut buf = Vec::with_capacity(len as usize);
        let buf_ptr = buf.as_mut_ptr() as *mut gl::types::GLchar;
        unsafe {
            gl::GetProgramInfoLog(self.id, len, std::ptr::null_mut(), buf_ptr);
            buf.set_len(len as usize);
        };

        match String::from_utf8(buf) {
            Ok(log) => log,
            Err(vec) => panic!("Could not convert link log from buffer: {}", vec),
        }
    }
}

/// ProgramUniformContext represents a valid context for assigning Program uniforms
///
/// The motivation for `ProgramUniformContext` is to limit access to Program
/// uniform setters for once a Program is in use.
/// The `glUniform...()` functions must be called after a `glUseProgram()`.
/// It's easy to invoke OpenGL functions in the wrong order, so this is a way
/// to enforce the correct order.
pub struct ProgramUniformContext;
impl ProgramUniformContext {
    /// Corresponds to `glUniform1i()`
    pub fn set_i32(&self, u: Uniform, v: i32) {
        unsafe {
            gl::Uniform1i(u.id, v);
        };
    }
    /// Corresponds to `glUniform1f()`
    pub fn set_float(&self, u: Uniform, v: f32) {
        unsafe {
            gl::Uniform1f(u.id, v);
        };
    }
    /// Corresponds with `glUniform1i()`
    pub fn set_bool(&self, u: Uniform, v: bool) {
        unsafe {
            gl::Uniform1i(
                u.id,
                match v {
                    true => 1,
                    false => 0,
                },
            );
        };
    }

    /// Corresponds to `glUniform3f()`
    pub fn set_vec3(&self, u: Uniform, v: (f32, f32, f32)) {
        let (x, y, z) = v;
        unsafe {
            gl::Uniform3f(u.id, x, y, z);
        };
    }

    pub fn set_vec2(&self, u: Uniform, v: (f32, f32)) {
        let (x, y) = v;
        unsafe {
            gl::Uniform2f(u.id, x, y);
        };
    }

    /// Corresponds to `glUniformMatrix4fv()`
    pub fn set_mat4(&self, u: Uniform, mat: &[[f32; 4]; 4]) {
        unsafe {
            let ptr: *const f32 = std::mem::transmute(mat);
            gl::UniformMatrix4fv(u.id, 1, gl::FALSE, ptr);
        };
    }
}

/// Encapsulates an OpenGL program uniform.
#[derive(Copy, Clone)]
pub struct Uniform {
    pub id: GLint,
}
