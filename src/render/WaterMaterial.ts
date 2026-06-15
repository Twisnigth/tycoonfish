import * as THREE from 'three';

/**
 * Matériau d'eau personnalisé (ShaderMaterial transparent optimisé) :
 *  - opacité pilotée par un terme de Fresnel (réflexion douce sur les bords),
 *  - léger assombrissement en profondeur (effet de volume),
 *  - ondulation subtile animée par `uTime`.
 * Pensé pour le style flat/pastel : pas de texture, tout est procédural.
 */
export function createWaterMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.42 },
      uFresnelPower: { value: 2.5 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying float vDepth;
      uniform float uTime;

      void main() {
        vec3 pos = position;
        // Ondulation de surface très douce (n'affecte que le haut du volume).
        float surf = smoothstep(0.0, 1.0, pos.y + 0.5);
        pos.y += sin(pos.x * 3.0 + uTime * 1.5) * 0.02 * surf;
        pos.x += cos(pos.z * 3.0 + uTime * 1.2) * 0.02 * surf;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        vDepth = pos.y; // -0.5 (bas) .. +0.5 (haut) en espace local normalisé
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying float vDepth;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uFresnelPower;

      void main() {
        float fresnel = pow(1.0 - clamp(dot(vViewDir, vNormalView), 0.0, 1.0), uFresnelPower);
        // Plus sombre en profondeur, plus clair en surface.
        vec3 deep = uColor * 0.7;
        vec3 shallow = mix(uColor, vec3(1.0), 0.25);
        vec3 col = mix(deep, shallow, clamp(vDepth + 0.5, 0.0, 1.0));
        col += fresnel * 0.35;
        float alpha = clamp(uOpacity + fresnel * 0.4, 0.0, 0.9);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}
