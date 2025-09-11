/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: Esto permite builds con errores de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: Permite builds con errores de TypeScript
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
