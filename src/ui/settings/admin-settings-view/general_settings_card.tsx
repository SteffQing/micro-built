"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";
import { CalendarDays, Globe } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

export const GeneralSettings = () => {
  // Platform Preferences
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [language, setLanguage] = useState("english");
  const [currency, setCurrency] = useState("ngn");

  // Loan Configuration
  const [interestRate, setInterestRate] = useState("10");
  const [tenure, setTenure] = useState("12");
  const [managementFee, setManagementFee] = useState("5");
  const [gracePeriod, setGracePeriod] = useState("5");

  // System Controls
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowTopUps, setAllowTopUps] = useState(true);
  const [apiToken, setApiToken] = useState("sk_test_placeholder");

  // Data Export & Loan Approval
  const [exportFormat, setExportFormat] = useState("csv");
  const [approvalMode, setApprovalMode] = useState("manual");

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [inventoryThreshold, setInventoryThreshold] = useState("1");
  const generateApiToken = () => {
    const newToken = "sk_test_" + Math.random().toString(36).substring(2, 15);
    setApiToken(newToken);
  };

  return (
    <Card className="bg-background">
      <Separator />
      <CardHeader>
        <CardTitle>Loan Configuration (Defaults)</CardTitle>
      </CardHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <Card className="bg-background border">
            <CardHeader>
              <CardTitle>Platform Preferences</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-6">
              <div className="w-full space-y-6 ">
                <div className="space-y-2 w-full">
                  <Label
                    htmlFor="date-format"
                    className="font-normal text-sm text-muted-foreground"
                  >
                    Default Date Format
                  </Label>
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger className="w-full justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarDays />
                        <SelectValue className="!text-sm !text-primary" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="language"
                    className="font-normal text-sm text-muted-foreground"
                  >
                    Default Language
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-full">
                      <div className="flex gap-2 items-center">
                        <Globe />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value="english">English Language</SelectItem>
                      <SelectItem value="french">French Language</SelectItem>
                      <SelectItem value="spanish">Spanish Language</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency" className="font-normal text-sm">
                    Default Currency Symbol
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ngn">₦ Nigerian Naira</SelectItem>
                      <SelectItem value="usd">$ US Dollar</SelectItem>
                      <SelectItem value="eur">€ Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background border">
            <CardHeader>
              <CardTitle className="font-normal text-sm">
                System Controls
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="maintenance-mode"
                    className="font-normal text-sm"
                  >
                    Enable Maintenance Mode
                  </Label>
                </div>
                <Switch
                  id="maintenance-mode"
                  checked={maintenanceMode}
                  onCheckedChange={setMaintenanceMode}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-topups" className="font-normal text-sm">
                    Allow Top-Ups
                  </Label>
                </div>
                <Switch
                  id="allow-topups"
                  checked={allowTopUps}
                  onCheckedChange={setAllowTopUps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-token" className="font-normal text-sm">
                  API Access Token
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="api-token"
                    value={apiToken}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={generateApiToken}
                    variant="outline"
                    className="text-green-600"
                  >
                    Generate
                  </Button>
                </div>
              </div>
            </CardContent>
            <Separator />
            <div className="px-6 space-y-3">
              <p className="font-normal text-sm">Data Export Settings</p>

              <RadioGroup
                value={exportFormat}
                onValueChange={setExportFormat}
                className="grid-cols-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv">CSV</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="excel" />
                  <Label htmlFor="excel">Excel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf" id="pdf" />
                  <Label htmlFor="pdf">PDF</Label>
                </div>
              </RadioGroup>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="bg-background border">
            <CardHeader>
              <CardTitle>Loan Configuration (Defaults)</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-6">
              <div className="w-full space-y-6 ">
                <div className="space-y-2">
                  <Label
                    htmlFor="interest-rate"
                    className="font-normal text-sm"
                  >
                    Interest Rate
                  </Label>
                  <div className="relative">
                    <Input
                      id="interest-rate"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      className="pr-8 bg-muted w-full"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenure" className="font-normal text-sm">
                    Tenure (Months)
                  </Label>
                  <Select value={tenure} onValueChange={setTenure}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                      <SelectItem value="18">18 Months</SelectItem>
                      <SelectItem value="24">24 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="management-fee"
                    className="font-normal text-sm"
                  >
                    Management Fee
                  </Label>
                  <div className="relative">
                    <Input
                      id="management-fee"
                      value={managementFee}
                      onChange={(e) => setManagementFee(e.target.value)}
                      className="pr-8 bg-muted"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grace-period" className="font-normal text-sm">
                    Grace Period
                  </Label>
                  <Select value={gracePeriod} onValueChange={setGracePeriod}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Days</SelectItem>
                      <SelectItem value="5">5 Days</SelectItem>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="10">10 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <Separator />
            <div className="px-6 space-y-4 ">
              <p className="text-sm font-normal">Loan Approval Mode</p>
              <RadioGroup
                value={approvalMode}
                onValueChange={setApprovalMode}
                className="grid-cols-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="font-normal">
                    Manual
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="automatic" id="automatic" />
                  <Label htmlFor="automatic" className="font-normal">
                    Automatic
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </Card>

          <Card className="bg-background border">
            <CardHeader>
              <CardTitle className="font-normal text-sm">
                Notifications and Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="email-notifications"
                    className="font-normal text-sm"
                  >
                    Email Notifications
                  </Label>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="sms-notifications"
                    className="font-normal text-sm"
                  >
                    SMS Notification
                  </Label>
                </div>
                <Switch
                  id="sms-notifications"
                  checked={smsNotifications}
                  onCheckedChange={setSmsNotifications}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="inventory-threshold"
                  className="font-normal text-sm"
                >
                  Inventory Threshold Alert
                </Label>
                <div className="relative max-w-xs">
                  <Input
                    id="inventory-threshold"
                    value={inventoryThreshold}
                    onChange={(e) => setInventoryThreshold(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Card>
  );
};
