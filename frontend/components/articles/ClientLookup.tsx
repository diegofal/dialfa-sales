'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useClients } from '@/lib/hooks/useClients';
import type { ClientDto } from '@/types/api';

interface ClientLookupProps {
  onSelectClient: (clientId: number, clientName: string) => void;
}

export function ClientLookup({ onSelectClient }: ClientLookupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  
  // Search clients as user types
  const { data: clientsResult } = useClients({ 
    searchTerm: searchTerm,
    activeOnly: true,
    pageSize: 10,
  });
  
  const clients = clientsResult?.data || [];

  // Reset selected index when clients change
  useEffect(() => {
    setSelectedIndex(0);
  }, [clients]);

  // Scroll to selected item
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, clients.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (clients.length > 0) {
        handleSelectClient(clients[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  };

  const handleSelectClient = (client: ClientDto) => {
    onSelectClient(client.id, client.businessName);
    setSearchTerm('');
    setShowResults(false);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value.toUpperCase());
            setShowResults(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => searchTerm && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Buscar cliente..."
          className="pl-7 text-sm h-9"
        />
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchTerm && clients.length > 0 && (
        <Card className="absolute z-[60] w-full mt-1 max-h-[280px] overflow-auto shadow-xl">
          <div className="p-1">
            {clients.map((client, index) => (
              <button
                key={client.id}
                ref={index === selectedIndex ? selectedItemRef : null}
                onClick={() => handleSelectClient(client)}
                className={`w-full text-left p-2.5 rounded transition-colors ${
                  index === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm ${index === selectedIndex ? 'text-primary-foreground' : ''}`}>
                      {client.businessName}
                    </div>
                    {client.code && (
                      <div className={`text-xs mt-0.5 ${index === selectedIndex ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                        Código: {client.code}
                      </div>
                    )}
                    {client.cuit && (
                      <div className={`text-xs ${index === selectedIndex ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        CUIT: {client.cuit}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="px-3 py-2 bg-muted/50 text-xs text-muted-foreground border-t">
            ↑↓ Navegar | Enter Seleccionar
          </div>
        </Card>
      )}

      {/* No Results Message */}
      {showResults && searchTerm && clients.length === 0 && (
        <Card className="absolute z-[60] w-full mt-1 p-3 text-center text-sm text-muted-foreground">
          No se encontraron clientes
        </Card>
      )}
    </div>
  );
}


