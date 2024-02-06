#version 330 core
    
uniform vec2 resolution;
uniform float time;
uniform vec3 cameraPos;
uniform vec3 rot;

out vec4 outcolor;

const int STEPS = 200;
const float HIT_DISTANCE = 0.0001;
const float MAX_DISTANCE = 128.0;

mat4 rotationFromAxis(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle), c = cos(angle), oc = 1.0 - c;
    return mat4(oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s, 0.0,
                oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s, 0.0,
                oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c, 0.0,
                0.0, 0.0, 0.0, 1.0);
}
// don ask why this is a mat3
mat3 rotation(float roll, float pitch, float yaw)
{
    float sinRoll = sin(roll);
    float cosRoll = cos(roll);
    float sinPitch = sin(pitch);
    float cosPitch = cos(pitch);
    float sinYaw = sin(yaw);
    float cosYaw = cos(yaw);
      
    return mat3(
        vec3(cosRoll * cosPitch, cosRoll * sinPitch * sinYaw - sinRoll * cosYaw, cosRoll * sinPitch * cosYaw + sinRoll * sinYaw),
        vec3(sinRoll * cosPitch, sinRoll * sinPitch * sinYaw + cosRoll * cosYaw, sinRoll * sinPitch * cosYaw - cosRoll * sinYaw),
        vec3(-sinPitch, cosPitch * sinYaw, cosPitch * cosYaw));
}

float sdfSphere(vec3 p, vec3 c, float r) {
    return length(mod(p, 2.0) - c) - r;
}

float sdfTorus(vec3 p, vec2 t, mat4 transform) {
    p = (vec4(p, 1.0) * transform).xyz; 
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float mandelbulbSdf(vec3 pos, out int steps) {
	vec3 z = pos;
	float dr = 1.0;
	float r = 0.0;
    const float Power = 3.0;
	for (int i = 0; i < 20 ; i++) {
		r = length(z);
        steps = i;
		if (r>4.0) break;
		
		// convert to polar coordinates
		float theta = acos(z.z/r);
		float phi = atan(z.y,z.x);
		dr =  pow( r, Power-1.0)*Power*dr + 1.0;
		
		// scale and rotate the point
		float zr = pow( r,Power);
		theta = theta*Power;
		phi = phi*Power;
		
		// convert back to cartesian coordinates
		z = zr*vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
		z+=pos;
	}

	return 0.5*log(r)*r/dr;
}

float map(vec3 currentPos) {

    float sphere = sdfSphere(currentPos, vec3(0.5), 0.1);
    // float plane = sdfPlane(newpos, vec3(0.0, 1.0, 0.0), 1.0);
    float torus = sdfTorus(currentPos - 0.5, vec2(0.15, 0.02), rotationFromAxis(vec3(1, 0.7, 0.4), time * 1.5));

    float m = min(sphere, torus);

    return m;
}

vec3 getNormal(vec3 p) {
    vec2 d = vec2(0.1, 0.0);
    vec3 n = vec3(map(p + d.xyy) - map(p - d.xyy),
                  map(p + d.yxy) - map(p - d.yxy),
                  map(p + d.yyx) - map(p - d.yyx));
    return normalize(n);
}

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
    vec3 surfaceNormal = getNormal(position);
    vec3 lightDirection = normalize(lightPosition - position);
    vec3 pointToCamera = normalize(cameraPosition - position);

    float brightness = phong(position, surfaceNormal, lightPosition, pointToCamera, ambient, diffuse, specular, shininess);
    clamp(dot(lightDirection, surfaceNormal), 0.0, 1.0);
    
    float distance = length(position - cameraPosition);
    
    // Apply fog.
    brightness /= max((distance - 1.5), 0.0001);
    
    return brightness;
}


// float raymarch(vec3 ro, vec3 rd, float maxDist) {
//     float dt = 0.0;
//     for (int i = 0; i < STEPS; ++i) {
//         vec3 cp = ro + rd * dt;
//         float d = map(cp);
//         if (d < HIT_DISTANCE || dt > maxDist) break;
//         dt += d;
//     }
//     return dt;
// }

vec3 wrapSpace(vec3 p)
{
    return mod(p, 1.0);
}

/**
 * Find the shortest distance to the inside
 * of an axis aligned unit cube.
 *
 * @param vec3 position The position of the ray to test.
 * @param vec3 rayDirection The direction of the ray.
 *
 * @return float Returns the distance between the point and the cube.
 */
float unitSpaceDistance(vec3 position, vec3 rayDirection)
{
    float dx, dy, dz;
    
    if (rayDirection.x < 0.0)
        dx = position.x;
    else
        dx = 1.0 - position.x;
        
    if (rayDirection.y < 0.0)
        dy = position.y;
    else
        dy = 1.0 - position.y;
        
    if (rayDirection.z < 0.0)
        dz = position.z;
    else
        dz = 1.0 - position.z;
        
    return min(min(dx, dy), dz);        
}

float rayMarchUnit(vec3 ro, vec3 rd)
{
    float distFromOrigin = 0.0;
    float totalDistance = 0.0;
    ro = wrapSpace(ro);
    
    int i;
    
    for (int i = 0; i < STEPS; ++i)
    {
        // cp current pos
        vec3 cp = ro + distFromOrigin * rd;
        float distToSdf = map(cp);
        // unit space dist
        float usdist = unitSpaceDistance(cp, rd);
        
        if (usdist < distToSdf)
        {
            distFromOrigin += usdist;
            totalDistance += usdist;
            
            if (usdist < HIT_DISTANCE || totalDistance > MAX_DISTANCE)
            {
                // make sure space wraps around properly
                ro = wrapSpace(ro + rd * (distFromOrigin + HIT_DISTANCE));
                distFromOrigin = 0.0;
            }
        }
        else
        {
            distFromOrigin += distToSdf;
            totalDistance += distToSdf;

            if (distToSdf < HIT_DISTANCE || totalDistance > MAX_DISTANCE)
                return min(MAX_DISTANCE, totalDistance);
        }
    }
    
    return MAX_DISTANCE;
}

vec3 render(vec2 uv) {
    // start off with white
    vec3 col = vec3(0.0);
    vec3 ro = cameraPos;
    vec3 rd = vec3(uv, 1.0) * rotation(rot.x, rot.y, rot.z);
    float dist = rayMarchUnit(ro, rd);
    if (dist < MAX_DISTANCE) {
        vec3 hitpos = ro + rd * dist;
        vec3 lightSource = vec3(2.5, 2.5, -1.0);
        col = vec3(shade(hitpos, lightSource, cameraPos, 1.0, 0.0, 0.0, 10.0));
    }
    return col;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - resolution.xy / 2.0) / resolution.y;
    vec3 color = render(uv);
    outcolor = vec4(color, 1.0);
}
