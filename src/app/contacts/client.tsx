"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Mail, Phone, Building, UserPlus } from "lucide-react";

interface Contact {
  id: string;
  fullName: string;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
}

interface ContactsClientProps {
  contacts: Contact[];
}

export function ContactsClient({ contacts }: ContactsClientProps) {
  const [search, setSearch] = useState("");

  const filteredContacts = contacts.filter((contact) => {
    const query = search.toLowerCase();
    return (
      contact.fullName.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query) ||
      contact.title?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground mt-2">
            {contacts.length} contacts synced from your sources
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No contacts found</h3>
            <p className="text-muted-foreground">
              {contacts.length === 0
                ? "Sync your contacts from iCloud or Google to get started"
                : "Try a different search term"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  const [isAddingVip, setIsAddingVip] = useState(false);

  async function handleAddVip() {
    setIsAddingVip(true);
    try {
      const res = await fetch("/api/vips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id }),
      });

      if (res.ok) {
        // TODO: Show success toast
      }
    } catch (error) {
      console.error("Failed to add VIP:", error);
    }
    setIsAddingVip(false);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg">{contact.fullName}</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAddVip}
            disabled={isAddingVip}
            title="Add to VIP list"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {contact.title && (
          <p className="text-sm text-muted-foreground mb-1">{contact.title}</p>
        )}

        {contact.company && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            <Building className="h-3 w-3" />
            {contact.company}
          </div>
        )}

        <div className="space-y-2 mt-3 pt-3 border-t">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3 w-3" />
              {contact.email}
            </a>
          )}

          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Phone className="h-3 w-3" />
              {contact.phone}
            </a>
          )}

          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              LinkedIn
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
