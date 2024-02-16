// This demo demonstrates simple cubemap reflections and more complex planar reflections

import PicoGL from "../node_modules/picogl/build/module/picogl.js";
import {mat4, vec3, mat3, vec4, vec2, quat} from "../node_modules/gl-matrix/esm/index.js";

import {positions, normals, indices, uvs} from "../blender/stickman2.js"
import {positions as planePositions, uvs as planeUvs, indices as planeIndices} from "../blender/plane.js"

// language=GLSL
let fragmentShader = `
    #version 300 es
    precision highp float;
    precision highp sampler2DShadow;

    uniform vec4 baseColor;
    uniform vec4 ambientColor;
    uniform vec3 lightPosition;
    uniform vec3 cameraPosition;    
    uniform sampler2DShadow shadowMap;

    uniform float time;
    uniform samplerCube cubemap;
    uniform sampler2D tex;    
    
    in vec3 vPosition;
    in vec4 vPositionFromLight;
    in vec3 vModelPosition;
    in vec3 vNormal;
    in vec3 viewDir;
    in vec2 v_uv;
    
    out vec4 outColor;
    
    void main()
    {    
        //Shadows
        vec3 shadowCoord = (vPositionFromLight.xyz / vPositionFromLight.w) / 2.0 + 0.5;        
        float shadow = texture(shadowMap, shadowCoord);
        
        vec3 normal = normalize(vNormal);
        vec3 eyeDirection = normalize(cameraPosition - vPosition);
        vec3 lightDirection = normalize(lightPosition - vPosition);        
        vec3 reflectionDirection = reflect(-lightDirection, normal);
        
        float diffuse = max(dot(lightDirection, normal), 0.0) * max(shadow, 0.2);        
        float specular = shadow * pow(max(dot(reflectionDirection, eyeDirection), 0.0), 100.0) * 0.7;
        outColor = vec4(diffuse * baseColor.rgb + ambientColor.rgb + specular, baseColor.a);
        
        
        // Reflections
        vec3 reflectedDir = reflect(viewDir, normalize(vNormal));
        outColor = texture(cubemap, reflectedDir);
        vec4 cubemapColor = texture(cubemap, reflectedDir);
        vec4 textureColor = texture(tex, v_uv); // Sample texture
        outColor = cubemapColor * textureColor; // Combine cubemap and texture colors
        
        // Try using a higher mipmap LOD to get a rough material effect without any performance impact
        // outColor = textureLod(cubemap, reflectedDir, 7.0);
        
       
    }
`;

// language=GLSL
let vertexShader = `
    #version 300 es
            
    uniform mat4 modelViewProjectionMatrix;
    uniform mat4 lightModelViewProjectionMatrix;
    uniform mat4 modelMatrix;
    uniform mat3 normalMatrix;
    uniform vec3 cameraPosition;
    
    layout(location=0) in vec4 position;
    layout(location=1) in vec3 normal;
    layout(location=2) in vec2 uv;
        
    out vec2 v_uv;
    out vec3 vNormal;
    out vec3 vPosition;
    out vec4 vPositionFromLight;
    out vec3 vModelPosition;
    out vec3 viewDir;
    
    void main()
    {
        gl_Position = modelViewProjectionMatrix * position;           
        v_uv = uv;
        viewDir = (modelMatrix * position).xyz - cameraPosition;                
        vModelPosition = vec3(position);
        vPosition = vec3(modelMatrix * position);
        vNormal = vec3(modelMatrix * vec4(normal, 0.0));
        vPositionFromLight = lightModelViewProjectionMatrix * position;
    }
`;

// language=GLSL
let mirrorFragmentShader = `
    #version 300 es
    precision highp float;
    
    uniform sampler2D reflectionTex;
    uniform sampler2D distortionMap;
    uniform vec2 screenSize;
    
    in vec2 vUv;        
        
    out vec4 outColor;
    
    void main()
    {                        
        vec2 screenPos = gl_FragCoord.xy / screenSize;
        
        // 0.03 is a mirror distortion factor, try making a larger distortion         
        screenPos.x += (texture(distortionMap, vUv).r - 0.5) * 0.3;
        outColor = texture(reflectionTex, screenPos);
    }
`;

// language=GLSL
let mirrorVertexShader = `
    #version 300 es
            
    uniform mat4 modelViewProjectionMatrix;
    
    layout(location=0) in vec4 position;   
    layout(location=1) in vec2 uv;
    
    out vec2 vUv;
        
    void main()
    {
        vUv = uv;
        vec4 pos = position;
        pos.xz *= 2.0;
        gl_Position = modelViewProjectionMatrix * pos;
    }
`;

// language=GLSL
let skyboxFragmentShader = `
    #version 300 es
    precision mediump float;
    
    uniform samplerCube cubemap;
    uniform mat4 viewProjectionInverse;
    
    in vec4 v_position;
    
    out vec4 outColor;
    
    void main() {
      vec4 t = viewProjectionInverse * v_position;
      outColor = texture(cubemap, normalize(t.xyz / t.w));
    }
`;

// language=GLSL
let skyboxVertexShader = `
    #version 300 es
    
    layout(location=0) in vec4 position;
    out vec4 v_position;
    
    void main() {
        v_position = vec4(position.xz, 1.0, 1.0);
        gl_Position = v_position;
    }
`;

// language=GLSL
let shadowFragmentShader = `
    #version 300 es
    precision highp float;
    
    out vec4 fragColor;
    
    void main() {
        // Uncomment to see the depth buffer of the shadow map    
        //fragColor = vec4((gl_FragCoord.z - 0.98) * 50.0);    
    }
`;

// language=GLSL
let shadowVertexShader = `
    #version 300 es
    layout(location=0) in vec4 position;
    uniform mat4 lightModelViewProjectionMatrix;
    
    void main() {
        gl_Position = lightModelViewProjectionMatrix * position;
    }
`;

let program = app.createProgram(vertexShader, fragmentShader);
let skyboxProgram = app.createProgram(skyboxVertexShader, skyboxFragmentShader);
let mirrorProgram = app.createProgram(mirrorVertexShader, mirrorFragmentShader);
let shadowProgram = app.createProgram(shadowVertexShader, shadowFragmentShader);

let vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, app.createVertexBuffer(PicoGL.FLOAT, 3, positions))
    .vertexAttributeBuffer(1, app.createVertexBuffer(PicoGL.FLOAT, 3, normals))
    .vertexAttributeBuffer(2, app.createVertexBuffer(PicoGL.FLOAT, 2, uvs))
    .indexBuffer(app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, indices));

const planePositionsBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, planePositions);
const planeUvsBuffer = app.createVertexBuffer(PicoGL.FLOAT, 2, planeUvs);
const planeIndicesBuffer = app.createIndexBuffer(PicoGL.UNSIGNED_INT, 3, planeIndices);

let skyboxArray = app.createVertexArray()
    .vertexAttributeBuffer(0, planePositionsBuffer)
    .indexBuffer(planeIndicesBuffer);

let mirrorArray = app.createVertexArray()
    .vertexAttributeBuffer(0, planePositionsBuffer)
    .vertexAttributeBuffer(1, planeUvsBuffer)
    .indexBuffer(planeIndicesBuffer);

// Change the shadow texture resolution to checkout the difference
let shadowDepthTarget = app.createTexture2D(512, 512, {
        internalFormat: PicoGL.DEPTH_COMPONENT16,
        compareMode: PicoGL.COMPARE_REF_TO_TEXTURE,
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR,
        wrapS: PicoGL.CLAMP_TO_EDGE,
        wrapT: PicoGL.CLAMP_TO_EDGE
    });
let shadowBuffer = app.createFramebuffer().depthTarget(shadowDepthTarget);

// Change the reflection texture resolution to checkout the difference
let reflectionResolutionFactor = 1;
let reflectionColorTarget = app.createTexture2D(app.width * reflectionResolutionFactor, app.height * reflectionResolutionFactor, {magFilter: PicoGL.LINEAR});
let reflectionDepthTarget = app.createTexture2D(app.width * reflectionResolutionFactor, app.height * reflectionResolutionFactor, {internalFormat: PicoGL.DEPTH_COMPONENT16});
let reflectionBuffer = app.createFramebuffer().colorTarget(0, reflectionColorTarget).depthTarget(reflectionDepthTarget);

let time = 0;
let projMatrix = mat4.create();
let viewMatrix = mat4.create();
let viewProjMatrix = mat4.create();
let modelMatrix = mat4.create();
let modelViewMatrix = mat4.create();
let modelViewProjectionMatrix = mat4.create();
let rotation = quat.create();
let lightModelViewProjectionMatrix = mat4.create();
let rotateXMatrix = mat4.create();
let rotateYMatrix = mat4.create();
let mirrorModelMatrix = mat4.create();

let lightPosition = vec3.create();
let lightViewMatrix = mat4.create();
let cameraPosition = vec3.create();
let lightViewProjMatrix = mat4.create();



function calculateSurfaceReflectionMatrix(reflectionMat, mirrorModelMatrix, surfaceNormal) {
    let normal = vec3.transformMat3(vec3.create(), surfaceNormal, mat3.normalFromMat4(mat3.create(), mirrorModelMatrix));
    let pos = mat4.getTranslation(vec3.create(), mirrorModelMatrix);
    let d = -vec3.dot(normal, pos);
    let plane = vec4.fromValues(normal[0], normal[1], normal[2], d);

    reflectionMat[0] = (1 - 2 * plane[0] * plane[0]);
    reflectionMat[4] = ( - 2 * plane[0] * plane[1]);
    reflectionMat[8] = ( - 2 * plane[0] * plane[2]);
    reflectionMat[12] = ( - 2 * plane[3] * plane[0]);

    reflectionMat[1] = ( - 2 * plane[1] * plane[0]);
    reflectionMat[5] = (1 - 2 * plane[1] * plane[1]);
    reflectionMat[9] = ( - 2 * plane[1] * plane[2]);
    reflectionMat[13] = ( - 2 * plane[3] * plane[1]);

    reflectionMat[2] = ( - 2 * plane[2] * plane[0]);
    reflectionMat[6] = ( - 2 * plane[2] * plane[1]);
    reflectionMat[10] = (1 - 2 * plane[2] * plane[2]);
    reflectionMat[14] = ( - 2 * plane[3] * plane[2]);

    reflectionMat[3] = 0;
    reflectionMat[7] = 0;
    reflectionMat[11] = 0;
    reflectionMat[15] = 1;

    return reflectionMat;
}

async function loadTexture(fileName) {
    return await createImageBitmap(await (await fetch("images/" + fileName)).blob());
}


const cubemap = app.createCubemap({
    negX: await loadTexture("negx.jpg"),
    posX: await loadTexture("posx.jpg"),
    negY: await loadTexture("negy.jpg"),
    posY: await loadTexture("posy.jpg"),
    negZ: await loadTexture("negz.jpg"),
    posZ: await loadTexture("posz.jpg")
});


const tex = await loadTexture("rain.jpg");
let drawCall = app.createDrawCall(program, vertexArray)

    .uniform("modelMatrix", modelMatrix)
    .uniform("modelViewProjectionMatrix", modelViewProjectionMatrix)
    .uniform("cameraPosition", cameraPosition)
    .uniform("lightPosition", lightPosition)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix)
    .texture("cubemap", cubemap)

    .texture("tex", app.createTexture2D(tex, tex.width, tex.height, {
        magFilter: PicoGL.LINEAR,
        minFilter: PicoGL.LINEAR_MIPMAP_LINEAR,
        maxAnisotropy: 10

    }))
    .texture("shadowMap", shadowDepthTarget);

let shadowDrawCall = app.createDrawCall(shadowProgram, vertexArray)
    .uniform("lightModelViewProjectionMatrix", lightModelViewProjectionMatrix);

function renderShadowMap() {
    app.drawFramebuffer(shadowBuffer);
    app.viewport(0, 0, shadowDepthTarget.width, shadowDepthTarget.height);
    app.gl.cullFace(app.gl.FRONT);

    // Projection and view matrices are changed to render objects from the point view of light source
    mat4.perspective(projMatrix, Math.PI * 0.1, shadowDepthTarget.width / shadowDepthTarget.height, 0.1, 100.0);
    mat4.multiply(lightViewProjMatrix, projMatrix, lightViewMatrix);

    drawObjects(cameraPosition, viewMatrix, shadowDrawCall, 0);

    app.gl.cullFace(app.gl.BACK);
    app.defaultDrawFramebuffer();
    app.defaultViewport();
}

let skyboxDrawCall = app.createDrawCall(skyboxProgram, skyboxArray)
    .texture("cubemap", cubemap);

let mirrorDrawCall = app.createDrawCall(mirrorProgram, mirrorArray)
    .texture("reflectionTex", reflectionColorTarget)
    .texture("distortionMap", app.createTexture2D(await loadTexture("bump.png")));



function renderReflectionTexture()
{
    app.drawFramebuffer(reflectionBuffer);
    app.viewport(0, 0, reflectionColorTarget.width, reflectionColorTarget.height);
    app.gl.cullFace(app.gl.FRONT);

    let reflectionMatrix = calculateSurfaceReflectionMatrix(mat4.create(), mirrorModelMatrix, vec3.fromValues(0, 1, 0));
    let reflectionViewMatrix = mat4.mul(mat4.create(), viewMatrix, reflectionMatrix);
    let reflectionCameraPosition = vec3.transformMat4(vec3.create(), cameraPosition, reflectionMatrix);
    drawObjects(reflectionCameraPosition, reflectionViewMatrix, drawCall, 0);

    app.gl.cullFace(app.gl.BACK);
    app.defaultDrawFramebuffer();
    app.defaultViewport();
}

function drawObjects(cameraPosition, viewMatrix, dc, time) {
    const scaleFactor = 0.5;
    mat4.scale(modelMatrix, modelMatrix, [scaleFactor, scaleFactor, scaleFactor]);
    mat4.multiply(viewProjMatrix, projMatrix, viewMatrix);

    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);

    let skyboxViewProjectionMatrix = mat4.create();
    let skyboxViewProjectionInverse = mat4.create();
    mat4.mul(skyboxViewProjectionMatrix, projMatrix, viewMatrix);
    mat4.invert(skyboxViewProjectionInverse, skyboxViewProjectionMatrix);

    app.clear();

    // Middle object
    quat.fromEuler(rotation, time * 48.24, time * 56.97, 0);
    mat4.fromRotationTranslationScale(modelMatrix, rotation, vec3.fromValues(0, 0, 0), [0.8, 0.8, 0.8]);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);

    dc.draw();

    // Large object
    quat.fromEuler(rotation, time * 12, time * 14, 0);
    mat4.fromRotationTranslationScale(modelMatrix, rotation, vec3.fromValues(-2.4, -2.4, -1.2), [2, 2, 2]);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);

    dc.draw();

    // Small object
    quat.fromEuler(rotation, time * 15, time * 17, 0);
    mat4.fromRotationTranslationScale(modelMatrix, rotation, vec3.fromValues(0.9, 0.9, 0.6), [0.22, 0.22, 0.22]);
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, modelMatrix);
    mat4.multiply(lightModelViewProjectionMatrix, lightViewProjMatrix, modelMatrix);

    dc.draw();

    app.disable(PicoGL.DEPTH_TEST);
    app.disable(PicoGL.CULL_FACE);
    skyboxDrawCall.uniform("viewProjectionInverse", skyboxViewProjectionInverse);
    skyboxDrawCall.draw();

    app.enable(PicoGL.DEPTH_TEST);
    app.enable(PicoGL.CULL_FACE);
    drawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix);
    drawCall.uniform("cameraPosition", cameraPosition);
    drawCall.uniform("modelMatrix", modelMatrix);
    drawCall.uniform("normalMatrix", mat3.normalFromMat4(mat3.create(), modelMatrix)); // reflects the skybox
    drawCall.draw();
}

function drawMirror() { // cubemap and planar reflections
    const scaleFactor = 2;
    mat4.scale(mirrorModelMatrix, mirrorModelMatrix, [scaleFactor, scaleFactor, scaleFactor]); //scale of the plane
    mat4.multiply(modelViewProjectionMatrix, viewProjMatrix, mirrorModelMatrix); 
    mirrorDrawCall.uniform("modelViewProjectionMatrix", modelViewProjectionMatrix); 
    mirrorDrawCall.uniform("screenSize", vec2.fromValues(app.width, app.height)) // reflection on the plane
    mirrorDrawCall.draw(); // makes the plane appear 
}

function draw(timems) {
    time = timems * 0.001;

    mat4.perspective(projMatrix, Math.PI / 2.5, app.width / app.height, 0.1, 100.0);
    vec3.rotateY(cameraPosition, vec3.fromValues(0, 1, 3.4), vec3.fromValues(0, 0, 0), time * 0.05);
    mat4.lookAt(viewMatrix, cameraPosition, vec3.fromValues(0, -0.5, 0), vec3.fromValues(0, 1, 0));

    mat4.fromXRotation(rotateXMatrix, time * 0.1136 - Math.PI / 2);
    mat4.fromZRotation(rotateYMatrix, time * 0.2235);
    mat4.mul(modelMatrix, rotateXMatrix, rotateYMatrix);

    mat4.fromXRotation(rotateXMatrix, 0.3);
    mat4.fromYRotation(rotateYMatrix, time * 0.2354);
    mat4.mul(mirrorModelMatrix, rotateYMatrix, rotateXMatrix);
    mat4.translate(mirrorModelMatrix, mirrorModelMatrix, vec3.fromValues(0, -1, 0));

    renderReflectionTexture();
    renderShadowMap();
    drawObjects(cameraPosition, viewMatrix, drawCall, time);
    drawMirror();    
    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
