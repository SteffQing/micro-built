"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, Calendar, FileText, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DownloadReportDialogCustomerProfile() {
  const [dateRange, setDateRange] = useState("");
  const [reportType, setReportType] = useState("");
  const [fileFormat, setFileFormat] = useState("");
  const [open, setOpen] = useState(false);

  const reportTypes = [
    { value: "sales", label: "Sales Report" },
    { value: "analytics", label: "Analytics Report" },
    { value: "user-activity", label: "User Activity Report" },
    { value: "financial", label: "Financial Report" },
    { value: "performance", label: "Performance Report" },
  ];

  const fileFormats = [
    { value: "pdf", label: "PDF" },
    { value: "excel", label: "Excel (XLSX)" },
    { value: "csv", label: "CSV" },
    { value: "json", label: "JSON" },
  ];

  const handleDownload = () => {
    if (!dateRange || !reportType || !fileFormat) {
      alert("Please fill in all fields");
      return;
    }

    // Simulate download
    const selectedReport = reportTypes.find((r) => r.value === reportType)?.label;
    const selectedFormat = fileFormats.find((f) => f.value === fileFormat)?.label;
    alert(`Downloading ${selectedReport} as ${selectedFormat} for ${dateRange}`);

    // Close dialog and reset form
    setOpen(false);
    setDateRange("");
    setReportType("");
    setFileFormat("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowDownToLine className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label htmlFor="date-range" className="text-sm font-medium">
              Choose Date Range
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="date-range"
                type="date"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="pl-10"
                placeholder="Select date range"
              />
            </div>
          </div>

          {/* Report Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Report Type</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Select Report Type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select File Format</Label>
            <div className="relative">
              <Download className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Select value={fileFormat} onValueChange={setFileFormat}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Select File Format" />
                </SelectTrigger>
                <SelectContent>
                  {fileFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <div className="pt-2">
          <Button onClick={handleDownload} className="w-full bg-green-600 hover:bg-green-700 text-white">
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
