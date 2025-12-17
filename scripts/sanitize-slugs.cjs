/**
 * sanitize-slugs.cjs
 * 
 * Script tự động chuẩn hóa tên file và slug trong các category/blog files.
 * Chuyển đổi tiếng Việt có dấu thành ASCII không dấu.
 * 
 * Script này chạy TRƯỚC generate-cms-config.cjs và organize-blogs.cjs
 * 
 * Run: node scripts/sanitize-slugs.cjs
 */

const fs = require('fs');
const path = require('path');

const BLOG_CATEGORIES_DIR = path.join(__dirname, '../src/content/blog-categories');
const CATEGORIES_DIR = path.join(__dirname, '../src/content/categories');
const BLOG_DIR = path.join(__dirname, '../src/content/blog');

/**
 * Vietnamese diacritics to ASCII mapping
 */
const VIETNAMESE_MAP = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
    'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
    'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
    'Đ': 'D',
    'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
    'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
    'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
    'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
    'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
    'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
    'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y'
};

/**
 * Convert Vietnamese string to ASCII slug
 */
function toAsciiSlug(str) {
    let result = str.toLowerCase();

    // Replace Vietnamese characters
    for (const [viet, ascii] of Object.entries(VIETNAMESE_MAP)) {
        result = result.split(viet.toLowerCase()).join(ascii.toLowerCase());
    }

    // Replace spaces with hyphens
    result = result.replace(/\s+/g, '-');

    // Remove any non-ASCII characters that remain
    result = result.replace(/[^a-z0-9-]/g, '');

    // Remove multiple consecutive hyphens
    result = result.replace(/-+/g, '-');

    // Remove leading/trailing hyphens
    result = result.replace(/^-|-$/g, '');

    return result;
}

/**
 * Check if filename contains Vietnamese diacritics
 */
function hasVietnameseDiacritics(str) {
    return Object.keys(VIETNAMESE_MAP).some(char => str.includes(char));
}

/**
 * Sanitize category JSON files
 */
function sanitizeCategoryFiles(dir, type) {
    if (!fs.existsSync(dir)) {
        console.log(`⚠️  Directory not found: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    let fixedCount = 0;

    for (const file of files) {
        const filePath = path.join(dir, file);

        // Check if filename has diacritics
        if (hasVietnameseDiacritics(file)) {
            try {
                // Read content
                const content = fs.readFileSync(filePath, 'utf-8');
                const json = JSON.parse(content);

                // Calculate new slug
                const newSlug = toAsciiSlug(json.slug || json.id || file.replace('.json', ''));
                const newFileName = `${newSlug}.json`;
                const newFilePath = path.join(dir, newFileName);

                // Update JSON content
                json.id = newSlug;
                json.slug = newSlug;

                // Write updated content to new file
                fs.writeFileSync(newFilePath, JSON.stringify(json, null, 2), 'utf-8');

                // Delete old file
                fs.unlinkSync(filePath);

                console.log(`✅ [${type}] Renamed: ${file} → ${newFileName}`);
                console.log(`   Updated slug: ${json.slug} → ${newSlug}`);
                fixedCount++;
            } catch (error) {
                console.error(`❌ Error processing ${file}: ${error.message}`);
            }
        }
    }

    return fixedCount;
}

/**
 * Sanitize blog post markdown files
 */
function sanitizeBlogFiles() {
    if (!fs.existsSync(BLOG_DIR)) {
        console.log(`⚠️  Blog directory not found: ${BLOG_DIR}`);
        return 0;
    }

    let fixedCount = 0;

    // Get all subdirectories
    const subdirs = fs.readdirSync(BLOG_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    for (const subdir of subdirs) {
        const subdirPath = path.join(BLOG_DIR, subdir);
        const files = fs.readdirSync(subdirPath).filter(f => f.endsWith('.md'));

        for (const file of files) {
            const filePath = path.join(subdirPath, file);

            // Check if filename has diacritics
            if (hasVietnameseDiacritics(file)) {
                try {
                    // Read content
                    const content = fs.readFileSync(filePath, 'utf-8');

                    // Extract and update frontmatter
                    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                    if (frontmatterMatch) {
                        let frontmatter = frontmatterMatch[1];
                        const body = content.slice(frontmatterMatch[0].length);

                        // Update slug in frontmatter
                        const slugMatch = frontmatter.match(/^slug:\s*(.+)$/m);
                        if (slugMatch) {
                            const oldSlug = slugMatch[1].replace(/["']/g, '').trim();
                            const newSlug = toAsciiSlug(oldSlug);
                            frontmatter = frontmatter.replace(
                                /^slug:\s*.+$/m,
                                `slug: ${newSlug}`
                            );
                        }

                        // Update id in frontmatter
                        const idMatch = frontmatter.match(/^id:\s*(.+)$/m);
                        if (idMatch) {
                            const oldId = idMatch[1].replace(/["']/g, '').trim();
                            const newId = toAsciiSlug(oldId);
                            frontmatter = frontmatter.replace(
                                /^id:\s*.+$/m,
                                `id: ${newId}`
                            );
                        }

                        // Update category in frontmatter (ensure it's ASCII)
                        const categoryMatch = frontmatter.match(/^category:\s*(.+)$/m);
                        if (categoryMatch) {
                            const oldCategory = categoryMatch[1].replace(/["']/g, '').trim();
                            const newCategory = toAsciiSlug(oldCategory);
                            frontmatter = frontmatter.replace(
                                /^category:\s*.+$/m,
                                `category: ${newCategory}`
                            );
                        }

                        // Write updated content
                        const newContent = `---\n${frontmatter}\n---${body}`;

                        // Calculate new filename
                        const baseName = file.replace('.md', '');
                        const newFileName = `${toAsciiSlug(baseName)}.md`;
                        const newFilePath = path.join(subdirPath, newFileName);

                        // Write to new file
                        fs.writeFileSync(newFilePath, newContent, 'utf-8');

                        // Delete old file if different
                        if (file !== newFileName) {
                            fs.unlinkSync(filePath);
                        }

                        console.log(`✅ [Blog] Renamed: ${file} → ${newFileName}`);
                        fixedCount++;
                    }
                } catch (error) {
                    console.error(`❌ Error processing ${file}: ${error.message}`);
                }
            }
        }
    }

    return fixedCount;
}

/**
 * Main function
 */
function main() {
    console.log('\n🔧 Sanitizing Vietnamese slugs to ASCII...\n');

    let totalFixed = 0;

    // Sanitize blog categories
    const blogCatFixed = sanitizeCategoryFiles(BLOG_CATEGORIES_DIR, 'Blog Category');
    totalFixed += blogCatFixed || 0;

    // Sanitize product categories
    const prodCatFixed = sanitizeCategoryFiles(CATEGORIES_DIR, 'Product Category');
    totalFixed += prodCatFixed || 0;

    // Sanitize blog posts
    const blogFixed = sanitizeBlogFiles();
    totalFixed += blogFixed || 0;

    console.log('\n📊 Summary:');
    if (totalFixed === 0) {
        console.log('✨ All files already have ASCII-compliant names!\n');
    } else {
        console.log(`✅ Fixed ${totalFixed} file(s) with Vietnamese diacritics.\n`);
    }
}

main();
