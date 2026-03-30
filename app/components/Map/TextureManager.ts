export class TextureManager {
  public readonly TEX_BASE: string;
  public readonly PLANET: string;
  public readonly SPRITE: string;
  public readonly LENS: string;
  public readonly IMG_BASE: string;

  constructor() {
    this.TEX_BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r161/examples/textures/';
    this.PLANET = this.TEX_BASE + 'planets/';
    this.SPRITE = this.TEX_BASE + 'sprites/';
    this.LENS = this.TEX_BASE + 'lensflare/';
    this.IMG_BASE = 'static/planets/';
  }

  public earthDayMap(): string {
    return this.PLANET + 'earth_atmos_2048.jpg';
  }

  public earthNormalMap(): string {
    return this.PLANET + 'earth_normal_2048.jpg';
  }

  public earthSpecularMap(): string {
    return this.PLANET + 'earth_specular_2048.jpg';
  }

  public earthLightsMap(): string {
    return this.PLANET + 'earth_lights_2048.png';
  }

  public earthCloudsMap(): string {
    return this.PLANET + 'earth_clouds_2048.png';
  }
}
