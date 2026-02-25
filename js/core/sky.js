// Sky, Atmosphere, Clouds, Day/Night Cycle for PHLY
const SkySystem = {
  scene: null,
  skyDome: null,
  sunLight: null,
  ambientLight: null,
  sunPosition: new THREE.Vector3(0, 1, 0),
  timeOfDay: 0.25, // 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
  cycleSpeed: 1 / 1200, // 20 min full cycle
  clouds: [],
  stars: null,

  init(scene) {
    this.scene = scene;
    this._createSkyDome();
    this._createSun();
    this._createStars();
    this._createClouds();

    const speed = DAY_NIGHT_SPEEDS[GAME_SETTINGS.dayNightSpeed] || 1200;
    this.cycleSpeed = speed > 0 ? 1 / speed : 0;
    this.timeOfDay = 0.35; // Start morning

    console.log('[PHLY][Sky] Initialized, cycle speed:', speed, 's');
  },

  _createSkyDome() {
    const geo = new THREE.SphereGeometry(40000, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0, 0.5, 0.5) },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vNormal;

        vec3 rayleigh(vec3 dir, vec3 sunDir) {
          float cosTheta = dot(dir, sunDir);
          float phase = 0.75 * (1.0 + cosTheta * cosTheta);
          float sunHeight = max(sunDir.y, -0.1);
          vec3 dayColor = mix(vec3(0.3, 0.5, 0.9), vec3(0.1, 0.3, 0.8), dir.y * 0.5 + 0.5);
          vec3 sunsetColor = mix(vec3(0.8, 0.3, 0.1), vec3(1.0, 0.6, 0.2), dir.y * 0.5 + 0.5);
          vec3 nightColor = vec3(0.02, 0.02, 0.06);
          vec3 color = dayColor;
          if (sunHeight < 0.2) {
            float t = smoothstep(0.0, 0.2, sunHeight);
            color = mix(nightColor, mix(sunsetColor, dayColor, t), t);
          }
          // Mie halo around sun
          float mie = pow(max(cosTheta, 0.0), 32.0) * 0.5;
          color += vec3(1.0, 0.8, 0.5) * mie * max(sunHeight, 0.0);
          return color * phase * 0.15 + color * 0.85;
        }

        void main() {
          vec3 dir = normalize(vNormal);
          vec3 col = rayleigh(dir, normalize(uSunDir));
          // Horizon fade
          float horizonFade = smoothstep(-0.05, 0.1, dir.y);
          col = mix(col * 1.3, col, horizonFade);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(geo, mat);
    this.skyDome.renderOrder = -1;
    this.scene.add(this.skyDome);
  },

  _createSun() {
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.position.set(100, 100, 100);
    this.sunLight.castShadow = GAME_SETTINGS.shadowQuality !== 'off';
    if (this.sunLight.castShadow) {
      this.sunLight.shadow.mapSize.width = 2048;
      this.sunLight.shadow.mapSize.height = 2048;
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 5000;
      this.sunLight.shadow.camera.left = -2000;
      this.sunLight.shadow.camera.right = 2000;
      this.sunLight.shadow.camera.top = 2000;
      this.sunLight.shadow.camera.bottom = -2000;
    }
    this.scene.add(this.sunLight);

    this.ambientLight = new THREE.AmbientLight(0x404060, 0.3);
    this.scene.add(this.ambientLight);

    // Hemisphere light for sky color contribution
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362d1b, 0.3);
    this.scene.add(this.hemiLight);
  },

  _createStars() {
    const count = 5000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Random points on unit sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 38000;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 2, transparent: true, opacity: 0,
      sizeAttenuation: false,
    });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  },

  _createClouds() {
    this.clouds = [];
    const cloudCount = Math.floor(GAME_SETTINGS.cloudDensity * 120);

    for (let i = 0; i < cloudCount; i++) {
      const isCirrus = i > cloudCount * 0.65;
      const altitude = isCirrus ? 5000 + Math.random() * 1000 : 1800 + Math.random() * 600;
      const size = isCirrus ? 200 + Math.random() * 400 : 100 + Math.random() * 300;

      const geo = new THREE.PlaneGeometry(size, size * 0.6);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: Math.random() * 100 },
          uOpacity: { value: isCirrus ? 0.3 : 0.7 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uSeed;
          uniform float uOpacity;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1,0));
            float c = hash(i + vec2(0,1));
            float d = hash(i + vec2(1,1));
            return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for(int i = 0; i < 4; i++) {
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec2 uv = vUv;
            float wind = uTime * 0.02;
            // Domain warping
            float warp = fbm(uv * 3.0 + uSeed + wind);
            float n = fbm(uv * 4.0 + warp * 0.5 + uSeed);
            float shape = smoothstep(0.35, 0.55, n);
            // Soft edges
            float edgeFade = smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.8, uv.x) *
                             smoothstep(0.0, 0.2, uv.y) * smoothstep(1.0, 0.8, uv.y);
            float alpha = shape * edgeFade * uOpacity;
            vec3 col = vec3(0.95, 0.95, 0.98);
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const cloud = new THREE.Mesh(geo, mat);
      cloud.position.set(
        (Math.random() - 0.5) * 30000,
        altitude,
        (Math.random() - 0.5) * 30000
      );
      cloud.rotation.x = -Math.PI / 2;
      cloud.userData.baseX = cloud.position.x;
      cloud.userData.baseZ = cloud.position.z;
      cloud.userData.windSpeed = 5 + Math.random() * 15;
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
    console.log(`[PHLY][Sky] Created ${this.clouds.length} clouds`);
  },

  update(dt, playerPos) {
    // Day/night cycle
    if (this.cycleSpeed > 0) {
      this.timeOfDay += this.cycleSpeed * dt;
      if (this.timeOfDay > 1) this.timeOfDay -= 1;
    }

    // Sun position
    const sunAngle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    this.sunPosition.set(
      Math.cos(sunAngle) * 30000,
      Math.sin(sunAngle) * 30000,
      10000
    );

    // Update sky dome shader
    if (this.skyDome && this.skyDome.material.uniforms) {
      this.skyDome.material.uniforms.uSunDir.value.copy(this.sunPosition).normalize();
      this.skyDome.material.uniforms.uTime.value += dt;
    }
    // Sky dome follows player
    if (this.skyDome && playerPos) {
      this.skyDome.position.set(playerPos.x, 0, playerPos.z);
    }
    if (this.stars) {
      this.stars.position.set(playerPos.x, 0, playerPos.z);
    }

    // Sun light
    const sunHeight = Math.sin(sunAngle);
    const sunIntensity = PHLYMath.clamp(sunHeight * 2, 0.02, 1.0);
    const sunColorLerp = PHLYMath.clamp(sunHeight * 5, 0, 1);

    if (this.sunLight) {
      this.sunLight.position.copy(this.sunPosition);
      this.sunLight.target.position.copy(playerPos || new THREE.Vector3());
      this.sunLight.intensity = sunIntensity;
      // Sunrise/sunset orange -> noon white
      if (sunHeight < 0.2 && sunHeight > 0) {
        this.sunLight.color.setHex(0xff8844);
      } else if (sunHeight >= 0.2) {
        this.sunLight.color.lerpColors(
          new THREE.Color(0xff8844),
          new THREE.Color(0xffffff),
          PHLYMath.clamp((sunHeight - 0.2) / 0.3, 0, 1)
        );
      } else {
        this.sunLight.color.setHex(0xB0C4DE); // Moon color
        this.sunLight.intensity = 0.02;
      }
    }

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.1 + sunIntensity * 0.3;
    }

    // Stars visibility
    if (this.stars) {
      const starOpacity = PHLYMath.clamp(1 - sunHeight * 3, 0, 0.8);
      this.stars.material.opacity = starOpacity;
    }

    // Cloud animation
    const time = performance.now() / 1000;
    for (const cloud of this.clouds) {
      cloud.position.x = cloud.userData.baseX + time * cloud.userData.windSpeed;
      // Wrap clouds around player
      const dx = cloud.position.x - playerPos.x;
      if (Math.abs(dx) > 15000) {
        cloud.userData.baseX -= Math.sign(dx) * 30000;
      }
      const dz = cloud.position.z - playerPos.z;
      if (Math.abs(dz) > 15000) {
        cloud.position.z -= Math.sign(dz) * 30000;
        cloud.userData.baseZ = cloud.position.z;
      }

      if (cloud.material.uniforms) {
        cloud.material.uniforms.uTime.value = time;
      }

      // Billboard: face camera
      cloud.lookAt(
        new THREE.Vector3(playerPos.x, cloud.position.y, playerPos.z)
      );
      cloud.rotation.x = -Math.PI / 2;
    }
  },

  getSunDirection() {
    return this.sunPosition.clone().normalize();
  },

  getTimeOfDay() {
    return this.timeOfDay;
  },

  getDaytimeLabel() {
    const t = this.timeOfDay;
    if (t < 0.2 || t > 0.85) return 'night';
    if (t < 0.3) return 'sunrise';
    if (t < 0.7) return 'day';
    return 'sunset';
  },
};

window.SkySystem = SkySystem;
console.log('[PHLY] Sky module loaded');
