export interface CodeArtwork {
  svg: string;
  png: Blob;
  value: string;
  width: number;
  height: number;
}

/** PNG 从同一份 SVG 光栅化，保证预览和两种下载的内容、静区和尺寸一致。 */
export async function rasterizeSvg(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法创建图像画布。');
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 导出失败。')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
