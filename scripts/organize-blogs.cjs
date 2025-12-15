/**
 * organize-blogs.cjs
 * 
 * Script tự động sắp xếp các bài viết blog vào thư mục đúng dựa trên trường category.
 * Script này chạy mỗi khi Netlify build, đảm bảo các bài viết luôn nằm trong thư mục đúng.
 */

const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');

// Danh sách các category hợp lệ (cũng là tên thư mục)
const VALID_CATEGORIES = [
    'tin-tuc-nganh-van-tai',
    'danh-gia-xe',
    'kinh-nghiem-lai-xe',
    'bao-duong',
    'tu-van-mua-xe',
    'cong-nghe-va-doi-moi',
    'luat-giao-thong'
];

/**
 * Parse frontmatter từ file markdown
 */
function parseFrontmatter(content) {
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = {};
    const lines = frontmatterMatch[1].split(/\r?\n/);

    for (const line of lines) {
        const match = line.match(/^(\w+):\s*"?([^"]*)"?$/);
        if (match) {
            frontmatter[match[1]] = match[2];
        }
    }

    return frontmatter;
}

/**
 * Đảm bảo thư mục tồn tại
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${path.basename(dirPath)}`);
    }
}

/**
 * Lấy tất cả file .md trong một thư mục
 */
function getMarkdownFiles(dir) {
    if (!fs.existsSync(dir)) return [];

    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getMarkdownFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Main function
 */
function organizeBlogPosts() {
    console.log('\n🔄 Organizing blog posts by category...\n');

    // Đảm bảo tất cả các thư mục category tồn tại
    for (const category of VALID_CATEGORIES) {
        ensureDirectoryExists(path.join(BLOG_DIR, category));
    }

    // Lấy tất cả file markdown
    const allFiles = getMarkdownFiles(BLOG_DIR);
    console.log(`📝 Found ${allFiles.length} blog post(s)\n`);

    let movedCount = 0;

    for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);

        if (!frontmatter || !frontmatter.category) {
            console.log(`⚠️  No category found in: ${path.basename(filePath)}`);
            continue;
        }

        const category = frontmatter.category;
        const currentDir = path.basename(path.dirname(filePath));
        const fileName = path.basename(filePath);

        // Kiểm tra category có hợp lệ không
        if (!VALID_CATEGORIES.includes(category)) {
            console.log(`⚠️  Invalid category "${category}" in: ${fileName}`);
            continue;
        }

        // Nếu file đã ở đúng thư mục, bỏ qua
        if (currentDir === category) {
            continue;
        }

        // Di chuyển file vào thư mục đúng
        const newPath = path.join(BLOG_DIR, category, fileName);

        try {
            fs.renameSync(filePath, newPath);
            console.log(`✅ Moved: ${fileName} → ${category}/`);
            movedCount++;
        } catch (error) {
            console.error(`❌ Error moving ${fileName}: ${error.message}`);
        }
    }

    if (movedCount === 0) {
        console.log('✨ All blog posts are already in the correct folders!\n');
    } else {
        console.log(`\n📦 Moved ${movedCount} file(s) to their correct category folders.\n`);
    }
}

// Run
organizeBlogPosts();
