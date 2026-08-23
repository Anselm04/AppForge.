# AppForge Documentation

Comprehensive documentation site built with Docusaurus.

## Quick Start

```bash
cd docs
npm install
npm start
```

Open http://localhost:3000 to view the documentation.

## Structure

```
docs/
├── docs/              # Documentation pages
│   ├── intro.md       # Introduction
│   ├── quickstart.md  # Quickstart guide
│   ├── api/           # API reference
│   ├── guides/        # Guides and tutorials
│   └── components/    # Component documentation
├── src/               # Custom React components
│   ├── css/           # Custom styles
│   └── components/    # Reusable components
├── static/            # Static assets
│   └── img/           # Images and logos
├── docusaurus.config.js  # Configuration
├── sidebars.js        # Navigation
└── package.json       # Dependencies
```

## Writing Documentation

### Markdown Files

Create `.md` files in the `docs/` directory:

```markdown
---
sidebar_position: 1
---

# Title

Content goes here...
```

### MDX (React in Markdown)

Use `.mdx` for React components:

```mdx
import MyComponent from '@site/src/components/MyComponent';

# Title

<MyComponent />
```

### Code Blocks

```typescript
const example = 'Hello World';
console.log(example);
```

### Internal Links

```markdown
[Link to Page](/docs/page-name)
```

## Configuration

### docusaurus.config.js

Main configuration file:
- Site metadata
- Theme settings
- Plugin configuration
- SEO settings

### sidebars.js

Navigation structure:
- Sidebar categories
- Page ordering
- Nested items

## Deployment

### Build

```bash
npm run build
```

### Deploy to Vercel

```bash
vercel
vercel --prod
```

### Deploy to Netlify

```bash
netlify deploy --prod
```

## Customization

### Custom CSS

Edit `src/css/custom.css`:

```css
:root {
  --ifm-color-primary: #2563eb;
}
```

### Custom Components

Create `src/components/MyComponent.tsx`:

```tsx
export default function MyComponent() {
  return <div>Hello!</div>;
}
```

### Custom Theme

Swizzle components:

```bash
npm run swizzle
```

## Best Practices

1. **Keep it simple** - Clear, concise writing
2. **Use examples** - Show, don't just tell
3. **Include images** - Screenshots, diagrams
4. **Link internally** - Connect related content
5. **Update regularly** - Keep docs current
6. **Test code** - Ensure examples work
7. **Get feedback** - Review with users

## Resources

- [Docusaurus Docs](https://docusaurus.io/docs)
- [MDX](https://mdxjs.com/)
- [Markdown Guide](https://www.markdownguide.org/)

## Support

- 💬 [Discord](https://discord.gg/appforge)
- 🐛 [GitHub Issues](https://github.com/Anselm04/AppForge/issues)
- 📧 [Email](mailto:hello@appforge.dev)
