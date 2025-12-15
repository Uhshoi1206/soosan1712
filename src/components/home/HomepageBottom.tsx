/**
 * HomepageBottom - Bottom sections (WeightCategories, BrandCategories, Testimonials, Contact, Blog)
 * Should be loaded with client:visible for below-fold optimization
 */
import React from 'react';
import { CompareProvider } from '@/contexts/CompareContextAstro';
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext';
import BrandCategories from './BrandCategories';
import ContactSection from './ContactSection';
import BlogSection from './BlogSection';
import WeightCategories from './WeightCategories';
import TestimonialSection from './TestimonialSection';
import { Truck } from '@/models/TruckTypes';
import type { SiteSettings } from '@/types/siteSettings';

interface HomepageBottomProps {
    trucks: Truck[];
    sortedPosts: any[];
    categoryMap: any;
    categoryInfoMap: any;
    siteSettings?: Partial<SiteSettings>;
}

const HomepageBottom: React.FC<HomepageBottomProps> = ({
    trucks,
    sortedPosts,
    categoryMap,
    categoryInfoMap,
    siteSettings
}) => {
    return (
        <SiteSettingsProvider settings={siteSettings}>
            <CompareProvider>
                <div className="w-full">
                    <div className="bg-gray-50 w-full">
                        <WeightCategories />
                    </div>

                    <BrandCategories trucks={trucks} />

                    <TestimonialSection products={trucks} />

                    <ContactSection />

                    <BlogSection
                        posts={sortedPosts.slice(0, 6)}
                        categories={categoryMap}
                        categoryInfoMap={categoryInfoMap}
                    />
                </div>
            </CompareProvider>
        </SiteSettingsProvider>
    );
};

export default HomepageBottom;
