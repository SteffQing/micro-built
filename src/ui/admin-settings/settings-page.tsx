"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
// import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  Plus,
  // Trash2,
  // Edit,
  CalendarDays,
  // ChevronDown,
  Globe,
} from "lucide-react";
import { SiteSubHeader } from "@/components/site-sub-header";
import { Separator } from "@/components/ui/separator";

const breadcrumbs = [
  {
    label: "Settings",
    href: "/admin/settings",
  },
];

const rightContent = <Button variant="outline">Save all changes</Button>;

export function SettingsClient() {
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

  // User Management
  const [users, setUsers] = useState([
    {
      id: 1,
      name: "Jebediah Cole",
      userId: "MB 114",
      email: "jebediah@gmail.com",
      role: "Loan Officer",
      lastLogin: "30, May 2023 12:20PM",
      status: "Active",
    },
    {
      id: 2,
      name: "Jebediah Cole",
      userId: "MB 114",
      email: "jebediah@gmail.com",
      role: "Inventory Manager",
      lastLogin: "21, May 2023 8:02PM",
      status: "Suspended",
    },
    {
      id: 3,
      name: "Jebediah Cole",
      userId: "MB 114",
      email: "jebediah@gmail.com",
      role: "Operations",
      lastLogin: "04, May 2023 1:30PM",
      status: "Active",
    },
  ]);

  

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  // const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  // const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    role: "Admin",
  });
  // const [editRole, setEditRole] = useState({
  //   role: "Admin",
  //   permissions: {
  //     viewOnly: false,
  //     edit: false,
  //     create: false,
  //     delete: false,
  //   },
  // });

  const generateApiToken = () => {
    const newToken = "sk_test_" + Math.random().toString(36).substring(2, 15);
    setApiToken(newToken);
  };

  const saveAllChanges = () => {
    // Demo function - in real app, this would save to backend
    alert("All changes saved successfully!");
    setUsers([
      {
        id: 1,
        name: "Jebediah Cole",
        userId: "MB 114",
        email: "jebediah@gmail.com",
        role: "Loan Officer",
        lastLogin: "30, May 2023 12:20PM",
        status: "Active",
      },
      {
        id: 2,
        name: "Jebediah Cole",
        userId: "MB 114",
        email: "jebediah@gmail.com",
        role: "Inventory Manager",
        lastLogin: "21, May 2023 8:02PM",
        status: "Suspended",
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full px-4 @container/main py-4 md:py-6 gap-4">
      <SiteSubHeader breadcrumbs={breadcrumbs} rightContent={rightContent} />

      <Tabs defaultValue="general" className="space-y-6 bg-background p-6">
        <TabsList>
          <TabsTrigger value="general" className="text-primary">
            General Settings
          </TabsTrigger>
          <TabsTrigger
            onClick={saveAllChanges}
            value="users"
            className="text-primary"
          >
            User Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          {/* Platform Preferences */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Card>
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
                          <SelectItem value="english">
                            English Language
                          </SelectItem>
                          <SelectItem value="french">
                            French Language
                          </SelectItem>
                          <SelectItem value="spanish">
                            Spanish Language
                          </SelectItem>
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
              {/* System Controls */}
              <Card>
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
                      <Label
                        htmlFor="allow-topups"
                        className="font-normal text-sm"
                      >
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
              {/* Loan Configuration */}
              <Card>
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
                      <Label
                        htmlFor="grace-period"
                        className="font-normal text-sm"
                      >
                        Grace Period
                      </Label>
                      <Select
                        value={gracePeriod}
                        onValueChange={setGracePeriod}
                      >
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
              {/* Notifications and Alerts */}
              <Card>
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
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Users List</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="text-green-600">
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Dialog
                open={isAddUserModalOpen}
                onOpenChange={setIsAddUserModalOpen}
              >
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add New User
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Full Name</Label>
                      <Input
                        id="full-name"
                        placeholder="Your Full Name"
                        value={newUser.fullName}
                        onChange={(e) =>
                          setNewUser({ ...newUser, fullName: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-address">Email Address</Label>
                      <Input
                        id="email-address"
                        type="email"
                        placeholder="Your Email Address"
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser({ ...newUser, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assign-role">Assign Role</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value) =>
                          setNewUser({ ...newUser, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Loan Officer">
                            Loan Officer
                          </SelectItem>
                          <SelectItem value="Inventory Manager">
                            Inventory Manager
                          </SelectItem>
                          <SelectItem value="Operations">Operations</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddUserModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        // Add user logic here
                        setIsAddUserModalOpen(false);
                        setNewUser({ fullName: "", email: "", role: "Admin" });
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.userId}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{user.lastLogin}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === "Active" ? "default" : "secondary"
                          }
                          className={
                            user.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      {/* <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Dialog
                            open={isEditRoleModalOpen}
                            onOpenChange={setIsEditRoleModalOpen}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setSelectedUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>
                                  Edit Roles & Permissions
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-assign-role">
                                    Assign Role
                                  </Label>
                                  <Select
                                    value={editRole.role}
                                    onValueChange={(value) =>
                                      setEditRole({ ...editRole, role: value })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Admin">
                                        Admin
                                      </SelectItem>
                                      <SelectItem value="Loan Officer">
                                        Loan Officer
                                      </SelectItem>
                                      <SelectItem value="Inventory Manager">
                                        Inventory Manager
                                      </SelectItem>
                                      <SelectItem value="Operations">
                                        Operations
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-3">
                                  <Label>Permissions</Label>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id="view-only"
                                        checked={editRole.permissions.viewOnly}
                                        onCheckedChange={(checked) =>
                                          setEditRole({
                                            ...editRole,
                                            permissions: {
                                              ...editRole.permissions,
                                              viewOnly: checked,
                                            },
                                          })
                                        }
                                      />
                                      <Label htmlFor="view-only">
                                        View-only
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id="edit"
                                        checked={editRole.permissions.edit}
                                        onCheckedChange={(checked) =>
                                          setEditRole({
                                            ...editRole,
                                            permissions: {
                                              ...editRole.permissions,
                                              edit: checked,
                                            },
                                          })
                                        }
                                      />
                                      <Label htmlFor="edit">Edit</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id="create"
                                        checked={editRole.permissions.create}
                                        onCheckedChange={(checked) =>
                                          setEditRole({
                                            ...editRole,
                                            permissions: {
                                              ...editRole.permissions,
                                              create: checked,
                                            },
                                          })
                                        }
                                      />
                                      <Label htmlFor="create">Create</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id="delete"
                                        checked={editRole.permissions.delete}
                                        onCheckedChange={(checked) =>
                                          setEditRole({
                                            ...editRole,
                                            permissions: {
                                              ...editRole.permissions,
                                              delete: checked,
                                            },
                                          })
                                        }
                                      />
                                      <Label htmlFor="delete">Delete</Label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => setIsEditRoleModalOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => {
                                    // Save role changes logic here
                                    setIsEditRoleModalOpen(false);
                                  }}
                                >
                                  Save
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell> */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-center space-x-2">
            <Button variant="ghost" size="sm" disabled>
              Prev
            </Button>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700"
              >
                1
              </Button>
              <Button variant="ghost" size="sm">
                2
              </Button>
              <Button variant="ghost" size="sm">
                3
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="text-green-600">
              Next
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
