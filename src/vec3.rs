pub struct Vec3 {
    x: f32,
    y: f32,
    z: f32
}

impl Vec3 {
    pub fn new(x: f32, y: f32, z: f32) -> Vec3 {
        Vec3 {
            x,
            y,
            z
        }
    }

    pub fn zero() -> Vec3 {
        Vec3 {
            x: 0.0,
            y: 0.0,
            z: 0.0
        }
    }

    pub fn x(&self) -> f32 {
        self.x
    }
    pub fn y(&self) -> f32 {
        self.y
    }
    pub fn z(&self) -> f32 {
        self.z
    }

    pub fn set_x(&mut self, x: f32) {
        self.x = x;
    }
    pub fn set_y(&mut self, y: f32) {
        self.y = y;
    }
    pub fn set_z(&mut self, z: f32) {
        self.z = z;
    }

    pub fn add_x(&mut self, x: f32) {
        self.x += x;
    }
    pub fn add_y(&mut self, y: f32) {
        self.y += y;
    }
    pub fn add_z(&mut self, z: f32) {
        self.z += z;
    }
    pub fn add(&mut self, other: &Vec3) {
        self.x += other.x;
        self.y += other.y;
        self.z += other.z;
    }
    pub fn rotate(&mut self, deg_vec: &Vec3) {
        let x: f32 = self.x;
        let y: f32 = self.y;
        let z: f32 = self.z;

        // rotation around specified axis. x_rot = rotation around x axis
        let x_rot = deg_vec.x;
        let y_rot = deg_vec.y;
        let z_rot = deg_vec.z;

        // self.x = x_rot.cos()*y_rot.cos() + (x_rot.cos()*y_rot.sin()*z_rot.sin()-);
    }
    
    pub fn normalize(&mut self) {
        self.x = self.x.sqrt();
    }
}