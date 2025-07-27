"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, Mail, Phone, MessageCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function UserIdentitySkeleton() {
  return (
    <div className="space-y-6">
      {/* User Identity Card Skeleton */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" /> {/* Title */}
            <Skeleton className="h-4 w-80" /> {/* Description */}
          </div>
          <Skeleton className="h-9 w-28" /> {/* Edit Details button */}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gender */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" /> {/* Label */}
              <div className="p-3 bg-gray-50 rounded-md">
                <Skeleton className="h-5 w-20" /> {/* Value */}
              </div>
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" /> {/* Label */}
              <div className="p-3 bg-gray-50 rounded-md">
                <Skeleton className="h-5 w-32" /> {/* Value */}
              </div>
            </div>

            {/* State of Residence */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" /> {/* Label */}
              <div className="p-3 bg-gray-50 rounded-md">
                <Skeleton className="h-5 w-16" /> {/* Value */}
              </div>
            </div>

            {/* Residential Address */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" /> {/* Label */}
              <div className="p-3 bg-gray-50 rounded-md">
                <Skeleton className="h-5 w-48" /> {/* Value */}
              </div>
            </div>

            {/* Next of Kin */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" /> {/* Label */}
              <div className="p-3 bg-gray-50 rounded-md">
                <Skeleton className="h-5 w-28" /> {/* Value */}
              </div>
            </div>

            {/* Next of Kin Phone Number */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" /> {/* Label */}
              <div className="p-3 bg-gray-50 rounded-md">
                <Skeleton className="h-5 w-36" /> {/* Value */}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Documents Card Skeleton */}
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" /> {/* Title */}
            <Skeleton className="h-4 w-96" /> {/* Description */}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Supported Documents Section */}
          <div>
            <Skeleton className="h-5 w-44 mb-3" /> {/* "Supported documents:" */}
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Skeleton className="w-2 h-2 rounded-full mt-2 flex-shrink-0" />
                <Skeleton className="h-4 w-80" />
              </div>
              <div className="flex items-start space-x-2">
                <Skeleton className="w-2 h-2 rounded-full mt-2 flex-shrink-0" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
          </div>

          {/* Documents Table Skeleton */}
          <div className="border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
              <Skeleton className="h-4 w-20" /> {/* Document */}
              <Skeleton className="h-4 w-16" /> {/* Status */}
              <Skeleton className="h-4 w-16" /> {/* Action */}
            </div>

            {/* Table Rows */}
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="grid grid-cols-3 gap-4 p-4 border-b last:border-b-0 items-center">
                <div>
                  <Skeleton className="h-4 w-24" /> {/* Document name */}
                </div>
                <div>
                  <Skeleton className="h-6 w-20 rounded-full" /> {/* Status badge */}
                </div>
                <div>
                  <Skeleton className="h-8 w-16" /> {/* Action button */}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface UserIdentityEmptyStateProps {
  onContactSupport?: () => void;
  supportEmail?: string;
  supportPhone?: string;
}

export function UserIdentityEmptyState({
  onContactSupport,
  supportEmail = "support@company.com",
  supportPhone = "+234-800-123-4567",
}: UserIdentityEmptyStateProps) {
  const handleEmailSupport = () => {
    window.location.href = `mailto:${supportEmail}?subject=Identity Information Setup Request&body=Hello Support Team,%0D%0A%0D%0AI need help setting up my identity information in the system so I can request for loans.%0D%0A%0D%0AThank you.`;
  };

  const handlePhoneSupport = () => {
    window.location.href = `tel:${supportPhone}`;
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center text-center p-8 space-y-6">
          {/* Icon */}
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>

          {/* Main Message */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">No Identity Information Found</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We don&#39;t have your identity information in our system yet. This information is required to process
              loan requests and ensure account security.
            </p>
          </div>

          {/* Warning Message */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 w-full">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Important Notice</p>
                <p>
                  You won&#39;t be able to request loans until your identity information is verified and added to our
                  system.
                </p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3 w-full">
            <p className="text-sm font-medium text-gray-900">To get started:</p>
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                <span>Contact our support team using any of the methods below</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                <span>Provide your personal and identification documents</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                <span>Wait for verification and account setup completion</span>
              </div>
            </div>
          </div>

          {/* Contact Options */}
          <div className="w-full space-y-3">
            <p className="text-sm font-medium text-gray-900">Contact Support:</p>

            <div className="grid gap-2">
              {/* Email Support */}
              <Button
                variant="outline"
                onClick={handleEmailSupport}
                className="w-full justify-start text-left h-auto p-3 bg-transparent"
              >
                <Mail className="w-4 h-4 mr-3 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-sm">Email Support</div>
                  <div className="text-xs text-gray-500">{supportEmail}</div>
                </div>
              </Button>

              {/* Phone Support */}
              <Button
                variant="outline"
                onClick={handlePhoneSupport}
                className="w-full justify-start text-left h-auto p-3 bg-transparent"
              >
                <Phone className="w-4 h-4 mr-3 flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-sm">Phone Support</div>
                  <div className="text-xs text-gray-500">{supportPhone}</div>
                </div>
              </Button>

              {/* General Contact Button */}
              {onContactSupport && (
                <Button onClick={onContactSupport} className="w-full bg-[#8B0000] hover:bg-[#6A0000] text-white">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Support Team
                </Button>
              )}
            </div>
          </div>

          {/* Additional Help */}
          <div className="text-xs text-gray-500 text-center">
            <p>Need immediate assistance?</p>
            <p>Our support team is available Monday - Friday, 9AM - 6PM WAT</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
