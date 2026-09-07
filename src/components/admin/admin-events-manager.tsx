'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageUpload } from '@/components/admin/image-upload';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Image from 'next/image';
import { Trash2, Edit2, Loader2, ChevronsUpDown, Check, Calendar as CalendarIcon, MapPin } from 'lucide-react';
import { createEvent, getAllEvents, updateEvent, deleteEvent, type EventDoc } from '@/services/eventsService';
import { formatEventDateRange, getEventEnd, getEventStart } from '@/lib/events';
import { deleteEventImage } from '@/services/storageService';
import { towns as allTownsData } from '@/lib/data/towns';
import { provinces } from '@/lib/data/provinces';

interface FormData {
  title: string;
  description: string;
  startDate: string; // yyyy-MM-dd, native date input format
  endDate: string; // same as startDate for a single-day event
  townSlug: string;
  imageUrl: string;
}

const initialFormData: FormData = {
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  townSlug: '',
  imageUrl: '',
};

export function AdminEventsManager() {
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [editingEvent, setEditingEvent] = useState<EventDoc | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isTownPopoverOpen, setTownPopoverOpen] = useState(false);
  const { toast } = useToast();

  const provinceMap = useMemo(() => new Map(provinces.map((p) => [p.slug, p.name])), []);
  const townsWithProvince = useMemo(
    () =>
      allTownsData
        .map((town) => ({ ...town, provinceName: provinceMap.get(town.provinceSlug) || '' }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [provinceMap]
  );
  const townNameMap = useMemo(() => new Map(allTownsData.map((t) => [t.slug, t.name])), []);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsFetching(true);
      const allEvents = await getAllEvents();
      setEvents(allEvents);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch events',
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.startDate) {
      toast({
        variant: 'destructive',
        title: 'Validation error',
        description: 'Please fill in the title, description, and start date',
      });
      return;
    }

    // A blank end date means a single-day event.
    const endDateValue = formData.endDate || formData.startDate;

    if (endDateValue < formData.startDate) {
      toast({
        variant: 'destructive',
        title: 'Validation error',
        description: 'The end date cannot be before the start date',
      });
      return;
    }

    setIsLoading(true);

    try {
      const eventPayload = {
        title: formData.title,
        description: formData.description,
        startDate: new Date(`${formData.startDate}T00:00:00`),
        endDate: new Date(`${endDateValue}T00:00:00`),
        ...(formData.townSlug ? { townSlug: formData.townSlug } : {}),
        ...(formData.imageUrl ? { imageUrl: formData.imageUrl } : {}),
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, eventPayload);
        toast({ title: 'Success', description: 'Event updated successfully' });
        setEditingEvent(null);
      } else {
        await createEvent(eventPayload);
        toast({ title: 'Success', description: 'Event created successfully' });
      }

      setFormData(initialFormData);
      setShowForm(false);
      await fetchEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        variant: 'destructive',
        title: editingEvent ? 'Failed to update event' : 'Failed to create event',
        description: error.message || 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (event: EventDoc) => {
    // Legacy docs may still carry only the old single `eventDate` field; the
    // helpers fall back to it so those can be edited into a proper range.
    const startDate = getEventStart(event);
    const endDate = getEventEnd(event);

    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
      townSlug: event.townSlug || '',
      imageUrl: event.imageUrl || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (event: EventDoc) => {
    if (!confirm(`Are you sure you want to delete "${event.title}"?`)) return;

    try {
      if (event.imageUrl) {
        await deleteEventImage(event.imageUrl);
      }

      await deleteEvent(event.id);

      toast({ title: 'Success', description: 'Event deleted successfully' });
      await fetchEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete event',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Event Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Events Management</h2>
          <p className="text-muted-foreground mt-1">Create, edit, and manage upcoming events</p>
        </div>
        <Button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditingEvent(null);
              setFormData(initialFormData);
            } else {
              setShowForm(true);
            }
          }}
          variant={showForm ? 'outline' : 'default'}
        >
          {showForm ? 'Cancel' : '+ New Event'}
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</CardTitle>
            <CardDescription>
              {editingEvent ? 'Update the fields below to edit this event' : 'Fill in the fields to create a new event'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="event-title">Title *</Label>
                <Input
                  id="event-title"
                  placeholder="Enter event title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              {/* Event Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-start-date">Start Date *</Label>
                  <Input
                    id="event-start-date"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                        // Keep a single-day event single-day, and never leave the
                        // end date stranded before the new start date.
                        endDate: !prev.endDate || prev.endDate < e.target.value ? e.target.value : prev.endDate,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-end-date">End Date *</Label>
                  <Input
                    id="event-end-date"
                    type="date"
                    min={formData.startDate || undefined}
                    value={formData.endDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Same as the start date for a one-day event.
                  </p>
                </div>
              </div>

              {/* Town (optional) */}
              <div className="space-y-2">
                <Label>Town (optional)</Label>
                <Popover open={isTownPopoverOpen} onOpenChange={setTownPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn('w-full justify-between', !formData.townSlug && 'text-muted-foreground')}
                    >
                      {formData.townSlug ? townNameMap.get(formData.townSlug) : 'Select a town...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search town..." />
                      <CommandList>
                        <ScrollArea className="h-72">
                          <CommandEmpty>No town found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                setFormData((prev) => ({ ...prev, townSlug: '' }));
                                setTownPopoverOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', !formData.townSlug ? 'opacity-100' : 'opacity-0')} />
                              No specific town
                            </CommandItem>
                            {townsWithProvince.map((town) => (
                              <CommandItem
                                value={town.name}
                                key={town.slug}
                                onSelect={() => {
                                  setFormData((prev) => ({ ...prev, townSlug: town.slug }));
                                  setTownPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn('mr-2 h-4 w-4', town.slug === formData.townSlug ? 'opacity-100' : 'opacity-0')}
                                />
                                {town.name} ({town.provinceName})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </ScrollArea>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="event-description">Description *</Label>
                <Textarea
                  id="event-description"
                  placeholder="What's happening at this event..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>

              {/* Image (optional) */}
              <ImageUpload
                label="Event Image (optional)"
                value={formData.imageUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
                folder="events"
              />

              {/* Submit Button */}
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingEvent ? 'Saving changes...' : 'Creating event...'}
                  </>
                ) : editingEvent ? (
                  'Save Changes'
                ) : (
                  'Create Event'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Events List */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">All Events ({events.length})</h3>

        {isFetching ? (
          <Card>
            <CardContent className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No events yet. Create your first event!
            </CardContent>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id} className="overflow-hidden hover:shadow-lg transition">
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                <div className="w-full md:w-48 h-48 relative flex-shrink-0 bg-muted">
                  {event.imageUrl && (
                    <Image src={event.imageUrl} alt={event.title} fill sizes="200px" className="object-cover" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-grow p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-semibold line-clamp-2">{event.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {formatEventDateRange(event) || 'No date set'}
                      </span>
                      {event.townSlug && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {townNameMap.get(event.townSlug) || event.townSlug}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(event)}>
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>

                    <Button variant="destructive" size="sm" onClick={() => handleDelete(event)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
