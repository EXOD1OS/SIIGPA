/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // Conservar la resolución de fuentes de PDFKit al ejecutar el paquete de producción.
  experimental: { serverComponentsExternalPackages: ['pdfkit'] },
};

module.exports = nextConfig;
