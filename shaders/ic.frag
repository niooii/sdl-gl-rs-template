#version 430 core

uniform vec2 resolution;
uniform float time;
uniform vec3 cameraPos;

precision highp float;
// The maximum distance to cast a ray when ray marching.
const float MAXIMUM_RAY_LENGTH = 100.0;

/**
 * Calculate the distance from a position to the surface of a sphere.
 *
 * @param vec3 position The position to test.
 * @param vec3 centre   The centre of the sphere.
 * @param vec3 radius   The radius of the sphere.
 *
 * @return float Returns the distance from the position to the sphere's surface.
 */
float sphereDistance(vec3 position, vec3 centre, float radius)
{
    return length(position - centre) - radius;
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

/**
 * Calculate the distance to a cube.
 *
 * @param vec3 position The position to test.
 * @param vec3 centre   The centre of the cube.
 * @param vec3 size     The length, width, and height.
 *
 * @return Returns the distance from the position to the closest point on the object.
 */
float boxDistance(vec3 position, vec3 centre, vec3 size)
{
    position -= centre;
    
    // Rounded corners.
    float radius = 0.1;
    
    return length(max(abs(position) - size, 0.0)) - radius;
    
}


/**
 * Get the distance from the given position to the nearest
 * point on a surface of an object in the scene.
 *
 * @param vec3 position The position to check.
 *
 * @return float Returns the minium distance from the position to a surface.
 */
float getSurfaceDistance(vec3 position)
{
    // Uncomment one of these to select which object to render.

    //return torusDistance(position, vec3(0.5, 0.5, 0.5), 0.2, 0.05);
    //return sphereDistance(position, vec3(0.5, 0.5, 0.5), 0.4);
    return sphereDistance(position, vec3(0.5), 0.2);
}

/**
 * Get the surface normal at the given point in world space.
 * This works by finding surface points a small distance away
 * from the position.
 *
 * @param vec3 position The position at which to find the normal.
 *
 * @return vec3 Returns a normal.
 */
vec3 getSurfaceNormal(vec3 position)
{
    vec2 epsilon = vec2(0.01, 0.0);
    float dist = getSurfaceDistance(position);
    vec3 normal = dist - vec3(
        getSurfaceDistance(position - epsilon.xyy),
        getSurfaceDistance(position - epsilon.yxy),
        getSurfaceDistance(position - epsilon.yyx));
        
    return normalize(normal);
}

/**
 * Wrap a position so it lies within
 * a unit cube from (0, 0, 0) to (1, 1, 1).
 *
 * @param vec3 position The position to wrap.
 *
 * @return vec3 Returns the position within a unit cube.
 */
vec3 unitSpace(vec3 position)
{
    return mod(position, 1.0);
}

/**
 * March rays through an infinitely tiled unit space.
 * 
 * @param vec3 rayOrigin    The starting point of the ray (camera position).
 * @param vec3 rayDirection The direction of the ray, in world space.
 *
 * @return vec3 Returns the distance from the ray origin at which the ray
 *              intersects the scene.
 */
float rayMarchUnitSpace(vec3 rayOrigin, vec3 rayDirection)
{
    const int MAX_STEPS = 140;
    const float RAY_INTERSECTION_DISTANCE = 0.001;
    float distanceFromOrigin = 0.0;
    float totalDistance = 0.0;
    rayOrigin = unitSpace(rayOrigin);
    
    int i;
    
    for (i = 0; i < MAX_STEPS; ++i)
    {
        vec3 rayPosition = rayOrigin + distanceFromOrigin * rayDirection;
        float surfaceDistance = getSurfaceDistance(rayPosition);
        float unitSpaceDistance = unitSpaceDistance(rayPosition, rayDirection);
        
        if (unitSpaceDistance < surfaceDistance)
        {
            distanceFromOrigin += unitSpaceDistance;
            totalDistance += unitSpaceDistance;
            
            if (unitSpaceDistance < RAY_INTERSECTION_DISTANCE || totalDistance > MAXIMUM_RAY_LENGTH)
            {
                rayOrigin = unitSpace(rayOrigin + rayDirection * (distanceFromOrigin + RAY_INTERSECTION_DISTANCE));
                distanceFromOrigin = 0.0;
            }
        }
        else
        {
            distanceFromOrigin += surfaceDistance;
            totalDistance += surfaceDistance;

            if (surfaceDistance < RAY_INTERSECTION_DISTANCE || totalDistance > MAXIMUM_RAY_LENGTH)
                break;
        }
    }
    
    if (i == MAX_STEPS)
        return MAXIMUM_RAY_LENGTH;
    
    return min(MAXIMUM_RAY_LENGTH, totalDistance);
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
    vec3 surfaceNormal = getSurfaceNormal(position);
    vec3 lightDirection = normalize(lightPosition - position);
    vec3 pointToCamera = normalize(cameraPosition - position);

    float brightness = phong(position, surfaceNormal, lightPosition, pointToCamera, ambient, diffuse, specular, shininess);
    clamp(dot(lightDirection, surfaceNormal), 0.0, 1.0);
    
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

/**
 * Build a rotation matrix.
 *
 * @param float roll  Rotation around the x axis in radians.
 * @param float pitch Rotation around the y axis in radians.
 * @param float yaw   Rotation around the z axis in radians.
 *
 * @return mat3 Returns a rotation matrix with the given Euler angles.
 */
mat3 rotationMatrix3d(float roll, float pitch, float yaw)
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

/**
 * The fragment shader function.
 *
 * @param vec4 fragColor The output fragment colour.
 * @param vec2 fragCoord The UV coordinates of the fragment.
 */
out vec4 outcolor;
void main()
{
    // Normalized pixel coordinates (from 0 to 1).
    vec2 uv = (gl_FragCoord.xy - resolution.xy / 2.0) / resolution.y;
    
    // Set up the camera.
    // mat3 cameraRotation = rotationMatrix3d(time * 0.1, time, time * 0.3);
    mat3 cameraRotation = mat3(0.0);
    
    // Set up the ray from the camera to the scene.
    vec3 rayDirection = vec3(uv.x, uv.y, 1.0);
    rayDirection = normalize(rayDirection);
    rayDirection *= cameraRotation;
    
    // Perform ray marching to find what the ray intersects.
    float surfaceDistance = rayMarchUnitSpace(cameraPos, rayDirection);
    
    vec3 surfacePoint = cameraPos + surfaceDistance * rayDirection;
    
    // Set up the light source.
    vec3 lightPosition = vec3(0.0, 5.0, 6.0);
    lightPosition.xz += vec2(sin(time), cos(time)) * 2.0;
  
    // Find the colour at the point of intersection.
    vec3 col = vec3(1.0 - shade(surfacePoint, lightPosition, cameraPos, 1.0, 0.0, 0.0, 10.0));

    // Set the output colour.
    outcolor = vec4(col, 1.0);
}
