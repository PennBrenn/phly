// Simplex Noise implementation for procedural terrain
const SimplexNoise = (function() {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const F3 = 1/3;
  const G3 = 1/6;
  const grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];

  function SimplexNoise(seed) {
    this.seed = seed || 0;
    this.p = new Uint8Array(512);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    const source = new Uint8Array(256);
    for (let i = 0; i < 256; i++) source[i] = i;
    let s = this.seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [source[i], source[j]] = [source[j], source[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = source[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  SimplexNoise.prototype.noise2D = function(xin, yin) {
    let n0, n1, n2;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 < 0) n0 = 0; else { t0 *= t0; n0 = t0 * t0 * (grad3[gi0][0]*x0 + grad3[gi0][1]*y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 < 0) n1 = 0; else { t1 *= t1; n1 = t1 * t1 * (grad3[gi1][0]*x1 + grad3[gi1][1]*y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 < 0) n2 = 0; else { t2 *= t2; n2 = t2 * t2 * (grad3[gi2][0]*x2 + grad3[gi2][1]*y2); }
    return 70.0 * (n0 + n1 + n2);
  };

  SimplexNoise.prototype.noise3D = function(xin, yin, zin) {
    let n0, n1, n2, n3;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const X0 = i - t, Y0 = j - t, Z0 = k - t;
    const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;
    let i1,j1,k1,i2,j2,k2;
    if (x0>=y0) {
      if (y0>=z0) {i1=1;j1=0;k1=0;i2=1;j2=1;k2=0;}
      else if (x0>=z0) {i1=1;j1=0;k1=0;i2=1;j2=0;k2=1;}
      else {i1=0;j1=0;k1=1;i2=1;j2=0;k2=1;}
    } else {
      if (y0<z0) {i1=0;j1=0;k1=1;i2=0;j2=1;k2=1;}
      else if (x0<z0) {i1=0;j1=1;k1=0;i2=0;j2=1;k2=1;}
      else {i1=0;j1=1;k1=0;i2=1;j2=1;k2=0;}
    }
    const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
    const x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
    const x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
    const ii=i&255,jj=j&255,kk=k&255;
    const gi0=this.permMod12[ii+this.perm[jj+this.perm[kk]]];
    const gi1=this.permMod12[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]];
    const gi2=this.permMod12[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]];
    const gi3=this.permMod12[ii+1+this.perm[jj+1+this.perm[kk+1]]];
    let t0=0.6-x0*x0-y0*y0-z0*z0;
    if(t0<0)n0=0;else{t0*=t0;n0=t0*t0*(grad3[gi0][0]*x0+grad3[gi0][1]*y0+grad3[gi0][2]*z0);}
    let t1=0.6-x1*x1-y1*y1-z1*z1;
    if(t1<0)n1=0;else{t1*=t1;n1=t1*t1*(grad3[gi1][0]*x1+grad3[gi1][1]*y1+grad3[gi1][2]*z1);}
    let t2=0.6-x2*x2-y2*y2-z2*z2;
    if(t2<0)n2=0;else{t2*=t2;n2=t2*t2*(grad3[gi2][0]*x2+grad3[gi2][1]*y2+grad3[gi2][2]*z2);}
    let t3=0.6-x3*x3-y3*y3-z3*z3;
    if(t3<0)n3=0;else{t3*=t3;n3=t3*t3*(grad3[gi3][0]*x3+grad3[gi3][1]*y3+grad3[gi3][2]*z3);}
    return 32.0*(n0+n1+n2+n3);
  };

  // FBM - Fractal Brownian Motion (4 octaves)
  SimplexNoise.prototype.fbm = function(x, z, octaves, lacunarity, gain) {
    octaves = octaves || 4;
    lacunarity = lacunarity || 2.0;
    gain = gain || 0.5;
    let sum = 0, amp = 1, freq = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise2D(x * freq, z * freq) * amp;
      maxAmp += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / maxAmp;
  };

  // Quick single-octave approximation for fallback
  SimplexNoise.prototype.fbmApprox = function(x, z) {
    return this.noise2D(x * 0.001, z * 0.001);
  };

  return SimplexNoise;
})();

window.SimplexNoise = SimplexNoise;
console.log('[PHLY] Noise module loaded');
