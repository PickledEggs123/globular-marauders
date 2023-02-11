require("@babel/register")({
    extensions: [".es6", ".es", ".jsx", ".js", ".mjs", ".tsx", ".ts"],
});

const AppRoutes = require("../src/AppRoutes.jsx").AppRoutes;
const GenerateSitemap = require("react-router-sitemap-maker").default;

(async () => {
    const sitemapData = await GenerateSitemap(AppRoutes(), {
        baseUrl: "https://globularmarauders.com",
        hashrouting: false,
        changeFrequency: "monthly",
    });

    await sitemapData.toFile("./build/sitemap.xml");
})();
