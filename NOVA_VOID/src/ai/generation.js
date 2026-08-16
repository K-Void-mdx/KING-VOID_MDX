export class GenerationService {
  constructor({ imageProvider = null, videoProvider = null } = {}) {
    this.imageProvider = imageProvider;
    this.videoProvider = videoProvider;
  }

  async image(prompt, options = {}) {
    if (!this.imageProvider) throw new Error('No image generation provider is configured');
    return this.imageProvider.generate({ prompt, ...options });
  }

  async video(prompt, options = {}) {
    if (!this.videoProvider) throw new Error('No video generation provider is configured');
    return this.videoProvider.generate({ prompt, ...options });
  }
}
