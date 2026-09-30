"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Pencil, Check, X, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Gender, MaritalStatus, Relationship } from "@/config/enums";
import { updateIdentity } from "@/lib/mutations/user";

const identitySchema = z.object({
  gender: z.nativeEnum(Gender),
  dateOfBirth: z.date({
    required_error: "A date of birth is required.",
  }),
  stateResidency: z.string().min(1, "State of residence is required"),
  residencyAddress: z.string().min(1, "Residential address is required"),
  landmarkOrBusStop: z.string().min(1, "Landmark or bus stop is required"),
  maritalStatus: z.nativeEnum(MaritalStatus),
  nextOfKinName: z.string().min(1, "Next of kin name is required"),
  nextOfKinContact: z.string().min(1, "Next of kin contact is required"),
  nextOfKinAddress: z.string().min(1, "Next of kin address is required"),
  nextOfKinRelationship: z.nativeEnum(Relationship),
});

type IdentityFormValues = z.infer<typeof identitySchema>;

export default function UserIdentitySection(props: UserIdentityDto) {
  const [isEditing, setIsEditing] = useState(false);

  const defaultDate = props.dateOfBirth
    ? new Date(props.dateOfBirth)
    : undefined;

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      gender: props.gender as Gender,
      dateOfBirth: defaultDate,
      stateResidency: props.stateResidency,
      residencyAddress: props.residencyAddress,
      landmarkOrBusStop: props.landmarkOrBusStop,
      maritalStatus: props.maritalStatus as MaritalStatus,
      nextOfKinName: props.nextOfKinName,
      nextOfKinContact: props.nextOfKinContact,
      nextOfKinAddress: props.nextOfKinAddress,
      nextOfKinRelationship: props.nextOfKinRelationship as Relationship,
    },
  });

  const { mutate, isPending } = useMutation(updateIdentity);

  function onSubmit(data: IdentityFormValues) {
    const payload = {
      ...data,
      dateOfBirth: format(data.dateOfBirth, "yyyy-MM-dd"),
    };

    mutate(payload, {
      onSuccess: () => {
        setIsEditing(false);
      },
      onError: (error) => {
        console.error("Failed to update identity:", String(error));
      },
    });
  }

  const toggleEdit = () => {
    if (isEditing) {
      form.reset();
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between pb-6">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-tight">
            User Identity
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage your personal identity information
          </p>
        </div>
        <Button
          variant={isEditing ? "ghost" : "outline"}
          size="sm"
          onClick={toggleEdit}
          disabled={isPending}
          className={cn(
            "transition-all duration-200 gap-2",
            isEditing && "hover:bg-destructive/10 hover:text-destructive"
          )}
        >
          {isEditing ? (
            <>
              <X className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <Pencil className="h-4 w-4" />
              Edit Details
            </>
          )}
        </Button>
      </div>
      <div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Gender
                    </FormLabel>
                    {isEditing ? (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(Gender).map((gender) => (
                            <SelectItem key={gender} value={gender}>
                              {gender}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-muted-foreground">
                      Date of Birth
                    </FormLabel>
                    {isEditing ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal bg-background",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                            captionLayout="dropdown"
                            fromYear={1900}
                            toYear={new Date().getFullYear()}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">
                          {field.value ? format(field.value, "PPP") : "Not set"}
                        </span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maritalStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Marital Status
                    </FormLabel>
                    {isEditing ? (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select marital status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(MaritalStatus).map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stateResidency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      State of Residence
                    </FormLabel>
                    {isEditing ? (
                      <FormControl>
                        <Input {...field} className="bg-background" />
                      </FormControl>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="residencyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Residential Address
                    </FormLabel>
                    {isEditing ? (
                      <FormControl>
                        <Input {...field} className="bg-background" />
                      </FormControl>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="landmarkOrBusStop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Landmark / Bus Stop
                    </FormLabel>
                    {isEditing ? (
                      <FormControl>
                        <Input {...field} className="bg-background" />
                      </FormControl>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextOfKinName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Next of Kin Name
                    </FormLabel>
                    {isEditing ? (
                      <FormControl>
                        <Input {...field} className="bg-background" />
                      </FormControl>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextOfKinContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Next of Kin Phone
                    </FormLabel>
                    {isEditing ? (
                      <FormControl>
                        <Input {...field} className="bg-background" />
                      </FormControl>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextOfKinAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Next of Kin Address
                    </FormLabel>
                    {isEditing ? (
                      <FormControl>
                        <Input {...field} className="bg-background" />
                      </FormControl>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextOfKinRelationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Relationship
                    </FormLabel>
                    {isEditing ? (
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(Relationship).map((rel) => (
                            <SelectItem key={rel} value={rel}>
                              {rel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 bg-muted/50 rounded-md border border-transparent">
                        <span className="font-medium">{field.value}</span>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3 pt-4 animate-in fade-in slide-in-from-top-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={toggleEdit}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" className="gap-2" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
