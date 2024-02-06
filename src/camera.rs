use crate::vec3::Vec3;

pub struct Camera {
    pos: Vec3,
    pitch: f32,
    roll: f32,
    yaw: f32
}

impl Camera {
    fn pos(&self) -> &Vec3 {
        &self.pos
    }

    // fn set_pos(&mut self, pos: &Vec3) {
    //     self.pos. = pos;
    // }
}