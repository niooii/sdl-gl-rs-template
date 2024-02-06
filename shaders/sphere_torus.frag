#version 330 core
    
uniform vec2 resolution;
uniform float time;
uniform vec3 cameraPos;

out vec4 outcolor;

const int STEPS = 256;
const float HIT_DISTANCE = 0.0001;
const float MAX_DISTANCE = 64.0;

mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle), c = cos(angle), oc = 1.0 - c;
    return mat4(oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s, 0.0,
                oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s, 0.0,
                oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c, 0.0,
                0.0, 0.0, 0.0, 1.0);
}

float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

float sdfSphere(vec3 p, vec3 c, float r) {
    return length(mod(p, 2.0) - c) - r;
}

float sdfTorus(vec3 p, vec2 t, mat4 transform) {
    p = (vec4(p, 1.0) * transform).xyz; 
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdfPlane(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}

float map(vec3 currentPos) {
    float tileSizeX = 0.0;
    float tileSizeZ = 0.0;
    float adjustedX = mod(currentPos.x, tileSizeX);
    float adjustedZ = mod(currentPos.z, tileSizeZ);
    
    vec3 newpos = vec3(adjustedX, currentPos.y, adjustedZ);

    float sphere = sdfSphere(newpos, vec3(0.0), 0.3);
    float plane = sdfPlane(newpos, vec3(0.0, 1.0, 0.0), 1.0);
    float torus = sdfTorus(newpos, vec2(1, 0.1), rotationMatrix(vec3(1, 0.7, 0.4), time * 1.5));

    float m = min(sphere, plane);
    m = opSmoothUnion(m, torus, 0.5);

    return m;
}

vec3 getNormal(vec3 p) {
    vec2 d = vec2(0.1, 0.0);
    vec3 n = vec3(map(p + d.xyy) - map(p - d.xyy),
                  map(p + d.yxy) - map(p - d.yxy),
                  map(p + d.yyx) - map(p - d.yyx));
    return normalize(n);
}

float raymarch(vec3 ro, vec3 rd, float maxDist) {
    float dt = 0.0;
    for (int i = 0; i < STEPS; ++i) {
        vec3 cp = ro + rd * dt;
        float d = map(cp);
        if (d < HIT_DISTANCE || dt > maxDist) break;
        dt += d;
    }
    return dt;
}

vec3 lighting(vec3 hitpos, vec3 normal, vec3 lightColor, vec3 lightSource) {
    vec3 col = vec3(0.0);
    float diffuseStrength = max(0.0, dot(normalize(lightSource), normal));
    vec3 diffuse = lightColor * diffuseStrength;

    vec3 viewSource = normalize(cameraPos);
    vec3 reflectSource = normalize(reflect(-lightSource, normal));

    float specularStrength = max(0.0, dot(viewSource, reflectSource));
    specularStrength = pow(specularStrength, 64.0);
    vec3 specular = specularStrength * lightColor;

    vec3 lighting = diffuse * 0.75 + specular * 0.25;

    float dist = raymarch(hitpos + normal * 0.1, -lightSource, length(lightSource - hitpos));
    col = (dist < length(lightSource - hitpos)) ? lighting * vec3(0.25) : lighting;

    return col;
}

vec3 render(vec2 uv) {
    vec3 col = vec3(0.0);
    vec3 ro = cameraPos;
    vec3 rd = vec3(uv, 1.0);
    float dist = raymarch(ro, rd, MAX_DISTANCE);
    if (dist < MAX_DISTANCE) {
        vec3 hitpos = ro + rd * dist;
        vec3 normal = getNormal(hitpos);
        vec3 lightColor = vec3(1.0);
        vec3 lightSource = vec3(2.5, 2.5, -1.0);
        col = lighting(hitpos, normal, lightColor, lightSource);
        col = pow(col, vec3(1.0 / 2.2));
    }
    return col;
}

void main() {
    vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - vec2(1.0);
    vec3 color = render(uv);
    outcolor = vec4(color, 1.0);
}
