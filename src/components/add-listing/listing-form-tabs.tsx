'use client';

import { useState, type ChangeEvent, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User } from 'firebase/auth';
import Image from 'next/image';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Translatable } from '@/components/translatable';
import { ListingTerms, ListingTermsAgreement, ListingTermsTrialNote } from '@/components/listing-terms';
import { useToast } from '@/hooks/use-toast';
import { towns } from '@/lib/data/towns';
import { Camera, CheckCircle, ChevronsUpDown, Check } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useFirestore, useStorage } from '@/firebase';
import { provinces } from '@/lib/data/provinces';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { serviceCategories } from '@/lib/service-categories';

interface ListingFormTabsProps {
  user: User;
}

const accommodationSchema = z.object({
  name: z.string().min(1, 'Property name is required'),
  townSlug: z.string().min(1, 'Town is required'),
  physicalAddress: z.string().optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  bookingSiteUrl: z.string().url().optional().or(z.literal('')),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1, 'Phone number is required'),
  description: z.string().min(1, 'Description is required').max(500),
  termsAndConditions: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms & Conditions." }),
  }),
});

const serviceProviderSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  townSlug: z.string().min(1, 'Town is required'),
  physicalAddress: z.string().optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1, 'Phone number is required'),
  description: z.string().min(1, 'Description is required').max(500),
  termsAndConditions: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms & Conditions." }),
  }),
});

const attractionSchema = z.object({
  name: z.string().min(1, 'Attraction name is required'),
  townSlug: z.string().min(1, 'Nearest Town is required'),
  physicalAddress: z.string().optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  contactEmail: z.string().email().optional().or(z.literal('')),
  description: z.string().min(1, 'Description is required').max(500),
  termsAndConditions: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms & Conditions." }),
  }),
});

type FormSchema = z.infer<typeof accommodationSchema> | z.infer<typeof serviceProviderSchema> | z.infer<typeof attractionSchema>;

const accommodationCategories = ['Hotel', 'Guesthouse', 'Self-Catering', 'B&B', 'Lodge', 'Backpackers', 'Other'];
const attractionCategories = ['Nature', 'Culture', 'Adventure', 'Historical', 'Other'];

export function ListingFormTabs({ user }: ListingFormTabsProps) {
  return (
    <Tabs defaultValue="accommodation" className="w-full">
      <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 h-auto">
        <TabsTrigger value="accommodation"><Translatable text="Accommodation" /></TabsTrigger>
        <TabsTrigger value="service"><Translatable text="Service Provider" /></TabsTrigger>
        <TabsTrigger value="attraction"><Translatable text="Attraction/Sight" /></TabsTrigger>
      </TabsList>
      <TabsContent value="accommodation">
        <ListingForm key="accommodation" user={user} collectionName="accommodations" formSchema={accommodationSchema} title="Accommodation" description="List your hotel, guesthouse, B&B, or other accommodation."
          fields={[
            { name: 'name', label: 'Accommodation Name', type: 'text' },
            { name: 'townSlug', label: 'Town', type: 'combobox' },
            { name: 'physicalAddress', label: 'Physical Address (optional)', type: 'textarea', optional: true, placeholder: "Enter the full physical address" },
            { name: 'category', label: 'Category', type: 'select', options: accommodationCategories.map(c => ({ value: c, label: c })) },
            { name: 'websiteUrl', label: 'Website URL', type: 'url', optional: true },
            { name: 'bookingSiteUrl', label: 'Booking Site URL', type: 'url', optional: true },
            { name: 'contactEmail', label: 'Contact Email', type: 'email' },
            { name: 'contactPhone', label: 'Contact Phone', type: 'tel' },
            { name: 'description', label: 'Description', type: 'textarea' },
          ]}
        />
      </TabsContent>
      <TabsContent value="service">
        <ListingForm key="service" user={user} collectionName="service_providers" formSchema={serviceProviderSchema} title="Service Provider" description="List your restaurant, tour, car rental, guide, or other travel service."
          fields={[
            { name: 'name', label: 'Service Name', type: 'text' },
            { name: 'townSlug', label: 'Town', type: 'combobox' },
            { name: 'physicalAddress', label: 'Physical Address (optional)', type: 'textarea', optional: true, placeholder: "Enter the full physical address" },
            { name: 'category', label: 'Category', type: 'select', options: serviceCategories.map(c => ({ value: c, label: c })) },
            { name: 'websiteUrl', label: 'Website URL', type: 'url', optional: true },
            { name: 'contactEmail', label: 'Contact Email', type: 'email' },
            { name: 'contactPhone', label: 'Contact Phone', type: 'tel' },
            { name: 'description', label: 'Description', type: 'textarea' },
          ]}
        />
      </TabsContent>
      <TabsContent value="attraction">
        <ListingForm key="attraction" user={user} collectionName="attractions" formSchema={attractionSchema} title="Attraction / Sight" description="Add a must-see attraction or point of interest."
          fields={[
            { name: 'name', label: 'Attraction Name', type: 'text' },
            { name: 'townSlug', label: 'Nearest Town', type: 'combobox' },
            { name: 'physicalAddress', label: 'Physical Address (optional)', type: 'textarea', optional: true, placeholder: "Enter the full physical address" },
            { name: 'category', label: 'Category', type: 'select', options: attractionCategories.map(c => ({ value: c, label: c })) },
            { name: 'websiteUrl', label: 'Website URL', type: 'url', optional: true },
            { name: 'contactEmail', label: 'Contact Email', type: 'email', optional: true },
            { name: 'description', label: 'Description', type: 'textarea' },
          ]}
        />
      </TabsContent>
    </Tabs>
  );
}

interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'url' | 'email' | 'tel' | 'combobox';
  options?: { value: string; label: string }[];
  optional?: boolean;
  placeholder?: string;
}

interface ListingFormProps {
  user: User;
  collectionName: string;
  formSchema: z.Schema<any>;
  title: string;
  description: string;
  fields: FieldConfig[];
}

function ListingForm({ user, collectionName, formSchema, title, description, fields }: ListingFormProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isTownPopoverOpen, setTownPopoverOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...fields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {}),
      contactEmail: user.email || '',
      termsAndConditions: false,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    form.setValue('contactEmail', user.email || '');
  }, [user.email, form]);

  const provinceMap = useMemo(() => new Map(provinces.map(p => [p.slug, p.name])), []);
  const townsWithProvince = useMemo(() => towns.map(town => ({
    ...town,
    provinceName: provinceMap.get(town.provinceSlug) || ''
  })).sort((a, b) => a.name.localeCompare(b.name)), [provinceMap]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "You must be logged in to submit a listing.",
        });
        return;
    }
    
    setIsSubmitting(true);

    try {
        const submissionCollectionName = `${collectionName}_submissions`;
        
        let imageUrls: string[] = [];
        if (imageFiles.length > 0) {
            const uploadPromises = imageFiles.map(async (file) => {
                const storageRef = ref(storage, `submissions/${collectionName}/${user.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                return getDownloadURL(storageRef);
            });
            imageUrls = await Promise.all(uploadPromises);
        }
        
        const docData = {
            ...values,
            submittedBy: user.uid,
           ownerUid: user.uid,
           ownerEmail: user.email,
           imageUrls,
           createdAt: serverTimestamp(),
           status: 'pending',
        };
        delete (docData as any).termsAndConditions;
        
        await addDoc(collection(firestore, submissionCollectionName), docData);

        toast({ title: 'Listing Submitted for Review!' });
        setSuccess(true);
        form.reset();
        setImagePreviews([]);
        setImageFiles([]);
        setTimeout(() => setSuccess(false), 6000);

    } catch (error: any) {
        console.error("Submission error:", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: error.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length + imagePreviews.length > 6) {
        toast({ variant: 'destructive', title: 'You can upload a maximum of 6 photos.' });
        return;
      }
      setImageFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  if (success) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
          <h2 className="mt-4 text-2xl font-bold font-headline"><Translatable text="Listing Submitted!" /></h2>
          <p className="mt-2 text-muted-foreground"><Translatable text="Thank you. Your listing has been submitted for review. We will review it shortly." /></p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-3xl text-primary"><Translatable text={`List Your ${title}`} /></CardTitle>
        <CardDescription><Translatable text={description} /></CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fields.map(field => (
                <FormField
                  key={field.name}
                  control={form.control}
                  name={field.name}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel><Translatable text={field.label} />{!field.optional && '*'}</FormLabel>
                      <FormControl>
                        {field.type === 'combobox' ? (
                          <Popover open={isTownPopoverOpen} onOpenChange={setTownPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className={cn("w-full justify-between", !formField.value && "text-muted-foreground")}>
                                {formField.value ? townsWithProvince.find(t => t.slug === formField.value)?.name : `Select a ${field.label.toLowerCase()}`}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                                <CommandInput placeholder={`Search ${field.label.toLowerCase()}...`} />
                                <CommandList>
                                  <ScrollArea className="h-72">
                                    <CommandEmpty>No town found.</CommandEmpty>
                                    <CommandGroup>
                                      {townsWithProvince.map((town) => (
                                        <CommandItem value={town.name} key={town.slug} onSelect={() => { form.setValue(field.name as any, town.slug); setTownPopoverOpen(false); }}>
                                          <Check className={cn("mr-2 h-4 w-4", town.slug === formField.value ? "opacity-100" : "opacity-0")} />
                                          {town.name} ({town.provinceName})
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </ScrollArea>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : field.type === 'select' ? (
                          <Select onValueChange={formField.onChange} defaultValue={formField.value}>
                            <SelectTrigger>
                              <SelectValue placeholder={`Select a ${field.label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <ScrollArea className="h-72">
                                {field.options?.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </ScrollArea>
                            </SelectContent>
                          </Select>
                        ) : field.type === 'textarea' ? (
                          <Textarea {...formField} placeholder={field.placeholder || `A bit about your ${title.toLowerCase()}...`} />
                        ) : (
                          <Input {...formField} type={field.type} disabled={field.name === 'contactEmail'} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="photos"><Translatable text="Upload Photos (up to 6)" /></Label>
              <div className="flex items-center justify-center w-full">
                <label htmlFor={`${collectionName}-photos`} className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold"><Translatable text="Click to upload" /></span> or drag and drop</p>
                    <p className="text-xs text-muted-foreground"><Translatable text="PNG, JPG" /></p>
                  </div>
                  <Input id={`${collectionName}-photos`} type="file" className="hidden" multiple accept="image/png, image/jpeg" onChange={handleImageChange} />
                </label>
              </div>
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mt-4">
                  {imagePreviews.map((src, index) => (
                    <div key={index} className="relative aspect-square">
                      <Image src={src} alt={`Preview ${index + 1}`} fill sizes="10vw" className="object-cover rounded-md" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ListingTerms>
              <FormField control={form.control} name="termsAndConditions" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 pt-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      <ListingTermsAgreement />
                    </FormLabel>
                    <ListingTermsTrialNote />
                    <FormMessage />
                  </div>
                </FormItem>
              )} />
            </ListingTerms>

            <Button type="submit" disabled={isSubmitting || !form.formState.isValid} className="w-full" size="lg">
              {isSubmitting ? <Translatable text="Submitting..." /> : <Translatable text="Submit for Approval" />}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
    
