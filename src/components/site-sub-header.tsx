import * as React from "react";
import type { ReactNode } from "react";
// import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Define breadcrumb item type
export type BreadcrumbItemProps = {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
};

// Define props for the PageHeader component
export interface PageHeaderProps {
  /**
   * Breadcrumb items to display on the left side
   * Pass an array of items with label, href, and isCurrentPage properties
   */
  breadcrumbs?: BreadcrumbItemProps[];
  
  /**
   * Custom breadcrumb component to render instead of the default
   * This takes precedence over the breadcrumbs array if both are provided
   */
  breadcrumbComponent?: ReactNode;
  
  /**
   * Custom content to display on the right side of the header
   */
  rightContent?: ReactNode;
  
  /**
   * Whether to show the sidebar trigger button
   * @default true
   */
  showSidebarTrigger?: boolean;
  
  /**
   * Additional CSS classes to apply to the header
   */
  className?: string;
}

/**
 * Default breadcrumb renderer component using shadcn/ui breadcrumb
 */
function DefaultBreadcrumbs({ items }: { items: BreadcrumbItemProps[] }) {
  if (!items || items.length === 0) return null;
  
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            <BreadcrumbItem>
              {item.isCurrentPage ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : item.href ? (
                <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
              ) : (
                <span className="text-muted-foreground">{item.label}</span>
              )}
            </BreadcrumbItem>
            
            {index < items.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * AdminPageHeader component for admin pages
 * Displays breadcrumbs on the left and custom content on the right
 */
export function SiteSubHeader({
  breadcrumbs,
  breadcrumbComponent,
  rightContent,
  // showSidebarTrigger = true,
  className = "",
}: PageHeaderProps) {
  return (
    <header className={`flex bg-background py-4 items-center gap-2 border-b transition-[width,height] ease-linear ${className}`}>
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        
        {/* Left side content - Breadcrumbs */}
        <div className="flex items-center ml-2">
          {breadcrumbComponent || (breadcrumbs && <DefaultBreadcrumbs items={breadcrumbs} />)}
        </div>

        {/* Right side content */}
        {rightContent && (
          <div className="ml-auto flex items-center gap-2">
            {rightContent}
          </div>
        )}
      </div>
    </header>
  );
}

