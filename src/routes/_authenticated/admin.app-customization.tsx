import { createFileRoute } from '@tanstack/react-router';
import { LiveCustomizationStudio } from './admin.app-customization-live';

export const Route = createFileRoute('/_authenticated/admin/app-customization')({ component: LiveCustomizationStudio });
