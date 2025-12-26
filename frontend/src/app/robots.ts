import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://vibedigest.neallin.xyz'

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/admin/'], // Adjust disallowed paths as needed
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
