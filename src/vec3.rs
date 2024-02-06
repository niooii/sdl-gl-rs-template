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
    
    pub fn normalize(&mut self) {
        self.x = self.x.sqrt();
    }
}