import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { RadioButton } from 'primeng/radiobutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { Dialog } from 'primeng/dialog';
import { Card } from 'primeng/card';
import ds from '../ds.config';

interface Invoice {
  id: string;
  customer: string;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Draft';
  severity: 'success' | 'warn' | 'danger' | 'secondary';
  amount: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule, Button, Tag, Message, InputText, Select, Checkbox, RadioButton, ToggleSwitch, Tooltip,
    TableModule, Dialog, Card,
  ],
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly ds = ds;
  protected readonly mode = signal<'light' | 'dark'>(ds.defaultMode);

  ngOnInit(): void {
    document.documentElement.classList.toggle('dark', this.mode() === 'dark');
  }

  protected readonly regions = ['eu-west', 'us-east', 'ap-south'];
  protected region = 'eu-west';
  protected updates = true;
  protected plan: 'starter' | 'pro' = 'starter';
  protected alerts = true;
  protected deleteDialogOpen = false;

  protected readonly invoices: Invoice[] = [
    { id: '#1042', customer: 'Globex', status: 'Paid', severity: 'success', amount: '$1,250.00' },
    { id: '#1043', customer: 'Initech', status: 'Pending', severity: 'warn', amount: '$840.50' },
    { id: '#1044', customer: 'Umbrella', status: 'Overdue', severity: 'danger', amount: '$2,310.00' },
    { id: '#1045', customer: 'Hooli', status: 'Draft', severity: 'secondary', amount: '$675.25' },
  ];

  toggleMode(): void {
    this.mode.set(this.mode() === 'dark' ? 'light' : 'dark');
    document.documentElement.classList.toggle('dark', this.mode() === 'dark');
  }
}
