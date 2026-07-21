import { useEffect, useState } from 'react';
import ds from './ds.config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const invoices = [
  { id: '#1042', customer: 'Globex', status: 'Paid', variant: 'default', amount: '$1,250.00' },
  { id: '#1043', customer: 'Initech', status: 'Pending', variant: 'secondary', amount: '$840.50' },
  { id: '#1044', customer: 'Umbrella', status: 'Overdue', variant: 'destructive', amount: '$2,310.00' },
  { id: '#1045', customer: 'Hooli', status: 'Draft', variant: 'outline', amount: '$675.25' },
] as const;

function SectionLabel({ children }: { children: string }) {
  return <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">{children}</h2>;
}

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>(ds.defaultMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  return (
    <>
      {/* demo chrome (not part of the fake app) */}
      <div className="bg-card text-muted-foreground flex items-center gap-3 border-b px-4 py-2 text-sm">
        <strong className="text-foreground">transtyle demo · {ds.label}</strong>
        <span>shadcn/ui — real registry components on the generated token contract</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
          {mode === 'dark' ? '☀ light' : '☾ dark'}
        </Button>
      </div>

      {/* §1 Header */}
      <header className="bg-background border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <span className="text-lg font-bold">Nimbus</span>
          <nav className="flex items-center gap-1 text-sm font-medium">
            <a className="text-foreground px-3 py-2" href="#">Dashboard</a>
            <a className="text-muted-foreground hover:text-foreground px-3 py-2" href="#">Reports</a>
            <a className="text-muted-foreground hover:text-foreground px-3 py-2" href="#">Settings</a>
          </nav>
          <span className="grow" />
          <Button>New report</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* §2 Buttons */}
        <section className="mb-10">
          <SectionLabel>2 · Buttons</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>Badge</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </section>

        <div className="mb-10 grid gap-10 lg:grid-cols-2">
          {/* §3 Form */}
          <section>
            <SectionLabel>3 · Form</SectionLabel>
            <form className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="f-name">Project name</Label>
                <Input id="f-name" placeholder="e.g. apollo-11" />
                <p className="text-muted-foreground text-sm">Lowercase letters and dashes only.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="f-email">Owner email</Label>
                <Input id="f-email" defaultValue="not-an-email" aria-invalid />
                <p className="text-destructive text-sm">That doesn't look like an email address.</p>
              </div>
              <div className="grid gap-2">
                <Label>Region</Label>
                <Select defaultValue="eu-west">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eu-west">eu-west</SelectItem>
                    <SelectItem value="us-east">us-east</SelectItem>
                    <SelectItem value="ap-south">ap-south</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="f-updates" defaultChecked />
                <Label htmlFor="f-updates">Email me weekly updates</Label>
              </div>
              <RadioGroup defaultValue="starter" className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="starter" id="f-plan-a" />
                  <Label htmlFor="f-plan-a">Starter plan</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="pro" id="f-plan-b" />
                  <Label htmlFor="f-plan-b">Pro plan</Label>
                </div>
              </RadioGroup>
              <div className="flex items-center gap-2">
                <Switch id="f-alerts" defaultChecked />
                <Label htmlFor="f-alerts">Enable usage alerts</Label>
              </div>
              <div className="flex gap-2">
                <Button type="button">Save changes</Button>
                <Button type="button" variant="outline">Cancel</Button>
              </div>
            </form>
          </section>

          {/* §4 Card */}
          <section>
            <SectionLabel>4 · Card</SectionLabel>
            <Card>
              <CardHeader>
                <CardTitle>Q2 growth report</CardTitle>
                <CardDescription>Generated 3 minutes ago</CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Revenue grew 18% quarter-over-quarter. The forecast pipeline is refreshed nightly by the{' '}
                  <code className="bg-muted rounded px-1 py-0.5 font-mono text-sm">nightly-sync</code> job; see the{' '}
                  <a className="text-primary underline-offset-4 hover:underline" href="#">full methodology</a> for caveats.
                </p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Share</Button>
                <Button size="sm" variant="outline">Export PDF</Button>
              </CardFooter>
            </Card>
          </section>
        </div>

        {/* §5 Table */}
        <section className="mb-10">
          <SectionLabel>5 · Table</SectionLabel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell>
                    <Badge variant={row.variant}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        {/* §6 Modal */}
        <section className="mb-10">
          <SectionLabel>6 · Modal</SectionLabel>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete workspace…</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete workspace?</DialogTitle>
                <DialogDescription>
                  This permanently deletes <strong>nimbus/production</strong> and all its reports. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive">Delete workspace</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      </main>
    </>
  );
}
