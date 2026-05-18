/** @type {import('next').NextConfig} */
const nextConfig = {
  // Move it out of experimental and put it here
  allowedDevOrigins: [
    '192.168.1.49',
    'mural-ipod-unpaired.ngrok-free.dev'
  ],
  experimental: {
    // Other experimental things can stay here if you have them
  }
};

export default nextConfig;