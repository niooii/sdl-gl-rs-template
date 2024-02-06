#version 330 core

uniform vec2 resolution;
uniform float time;
uniform vec3 cameraPos = vec3(0.0, 0.0, -2.0);

precision highp float;

out vec4 outcolor;

const int NUMBER_OF_STEPS = 200;
const float MINIMUM_HIT_DISTANCE = 0.0001;
const float MAXIMUM_TRACE_DISTANCE = 64.0;

// other wack math stuff
// THANK YOU CHAT GPT I DONT WANNA TYPE THIS
mat4 rotationMatrix(vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

float opSmoothUnion( float d1, float d2, float k )
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

// SDFS
float sdfSphere(vec3 p, vec3 c, float r) {
    return length(p - c) - r;
}

float sdfCylinder( vec3 p, vec3 c )
{
  return length(p.xz-c.xy)-c.z;
}

float sdfTorus( vec3 p, vec2 t , mat4 transform)
{
    p = (vec4(p, 1.0) * transform).xyz; 
    vec2 q = vec2(length(p.xz)-t.x,p.y);
    return length(q)-t.y;
}

float sdfPlane(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}

// render stuff

float map(vec3 currentPos) {

    float cylinder = sdfCylinder(currentPos, vec3(1.0));

    float m = cylinder;

    return m;
}

vec3 getNormal(vec3 p) {
    vec2 d = vec2(0.1, 0.0);

    float gx = map(p + d.xyy) - map(p - d.xyy);
    float gy = map(p + d.yxy) - map(p - d.yxy);
    float gz = map(p + d.yyx) - map(p - d.yyx);

    vec3 normal = vec3(gx, gy, gz);
    return normalize(normal);
}

/**
 * Calculate Phong shading.
 *
 * @param vec3  surfacePoint    The point being shaded.
 * @param vec3  normal          The surface normal.
 * @param vec3  lightPosition   The location of the light.
 * @param vec3  viewerDirection A unit vector from the surface point in the direction of the camera.
 * @param float ambient         The ambient lighting, 0..1.
 * @param float diffuse         The diffuse lighting, 0..1.
 * @param float specular        The specular highlight strength, 0..1.
 * @param float shininess       The highlight sharpness, 0.. higher gives a smaller reflection.
 */
float phong(vec3 surfacePoint, vec3 normal, vec3 lightPosition, vec3 viewerDirection, float ambient, float diffuse, float specular, float shininess)
{
    vec3 lightDirection = normalize(lightPosition - surfacePoint);
    
    vec3 reflection = normalize(2.0 * dot(lightDirection, normal) * normal - lightDirection);
    return ambient + diffuse * clamp(dot(lightDirection, normal), 0.0, 1.0) + specular * pow(clamp(dot(reflection, viewerDirection), 0.0, 1.0), shininess);
}

/**
 * Calculate the surface shading at the intersection point.
 *
 * @param vec3  position      The point on the surface.
 * @param vec3  lightPosition The position of the light source.
 * @param float ambient       The amount of ambient illumination.
 * @param float diffuse       The brightness of the diffuse lighting, 0..1.
 * @param float specular      The brightness of the specular highlight, 0..1.
 * @param float shininess     The sharpness of the specular highlight, higher being sharper.
 *
 * @return float Returns the brightness at the given position.
 */
float shade(vec3 position, vec3 lightPosition, vec3 cameraPosition, float ambient, float diffuse, float specular, float shininess)
{
    vec3 normal = getNormal(position);
    vec3 lightDirection = normalize(lightPosition - position);
    vec3 pointToCamera = normalize(cameraPosition - position);

    float brightness = phong(position, normal, lightPosition, pointToCamera, ambient, diffuse, specular, shininess);
    clamp(dot(lightDirection, normal), 0.0, 1.0);
    
    /*
    float distanceTowardsLight = rayMarch(position + surfaceNormal * 0.02, lightDirection);
    
    if (distanceTowardsLight < max(MAXIMUM_RAY_LENGTH, length(lightPosition - position) + 0.02))
      return ambient;
    */
    
    float distance = length(position - cameraPosition);
    
    // Apply fog.
    brightness /= max(distance - 2.0, 0.001);
    
    return brightness;
}

float raymarch(vec3 ro, vec3 rd, float maxDistance) {
    // distance traveled
    float dt = 0.0;

    for(int i = 0; i < NUMBER_OF_STEPS; i++) {
        vec3 currentPos = ro + rd * dt;
        float distToSdf = map(currentPos);

        if(distToSdf < MINIMUM_HIT_DISTANCE) {
            break;
        }

        dt += distToSdf;

        if(dt > maxDistance) {
            break;
        }
    }

    return dt;
}

vec3 render(vec2 uv) {
    vec3 color = vec3(1.0);

    vec3 ro = cameraPos;
    vec3 rd = vec3(uv, 1.0);

    float dist = raymarch(ro, rd, MAXIMUM_TRACE_DISTANCE);
    
    if(dist < MAXIMUM_TRACE_DISTANCE) {
        color = vec3(1.0);
        
        // calculate normal at exact point where we hit sdf
        vec3 hitpos = ro + rd * dist;
        // vec3 normal = getNormal(hitpos);
        // color = normal;
        
        // lighting stuff
        vec3 lightPos = vec3(2, 2, 3);
        color = vec3(0.7 - shade(hitpos, lightPos, cameraPos, 1.0, 0.0, 0.0, 10.0));

        // gamma correction
        color = pow(color, vec3(1.0 / 2.2));
    }

    return color;
}

void main() {
    vec2 uv = (gl_FragCoord.xy/resolution.xy) * 2.0 - 1.0;

    vec3 color = vec3(0.0);

    color = render(uv);

    outcolor = vec4(color, 0);
}