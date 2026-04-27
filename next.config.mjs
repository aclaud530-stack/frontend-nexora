/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // Variáveis de ambiente expostas ao browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_DERIV_APP_ID: process.env.NEXT_PUBLIC_DERIV_APP_ID,
    NEXT_PUBLIC_DERIV_CLIENT_ID: process.env.NEXT_PUBLIC_DERIV_CLIENT_ID,
    NEXT_PUBLIC_DERIV_REDIRECT_URI: process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI,
  },
}

export default nextConfig
