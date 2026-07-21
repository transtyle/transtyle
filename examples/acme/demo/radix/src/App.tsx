import { useEffect, useState } from 'react';
import {
  Theme,
  Box,
  Flex,
  Grid,
  Text,
  Heading,
  Button,
  Badge,
  Card,
  TextField,
  Select,
  Checkbox,
  RadioGroup,
  Switch,
  Table,
  Dialog,
  Link,
  Code,
} from '@radix-ui/themes';
import ds from './ds.config';

const invoices = [
  { id: '#1042', customer: 'Globex', status: 'Paid', color: 'green', amount: '$1,250.00' },
  { id: '#1043', customer: 'Initech', status: 'Pending', color: 'amber', amount: '$840.50' },
  { id: '#1044', customer: 'Umbrella', status: 'Overdue', color: 'red', amount: '$2,310.00' },
  { id: '#1045', customer: 'Hooli', status: 'Draft', color: 'gray', amount: '$675.25' },
] as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <Heading as="h2" size="1" mb="3" color="gray" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {children}
    </Heading>
  );
}

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>(ds.defaultMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  return (
    <Theme accentColor={ds.accentPreset} grayColor="gray" appearance={mode} radius="medium" style={{ minHeight: '100vh' }}>
      {/* demo chrome (not part of the fake app) */}
      <Flex align="center" gap="3" px="4" py="2" style={{ borderBottom: '1px solid var(--gray-a5)' }}>
        <Text weight="bold">transtyle demo · {ds.label}</Text>
        <Text color="gray" size="2">
          @radix-ui/themes — real components, {ds.accentPreset}/gray preset overridden by the compiled theme
        </Text>
        <Box flexGrow="1" />
        <Button variant="outline" size="1" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
          {mode === 'dark' ? '☀ light' : '☾ dark'}
        </Button>
      </Flex>

      {/* §1 Header */}
      <Box style={{ borderBottom: '1px solid var(--gray-a5)' }}>
        <Flex align="center" gap="4" px="4" style={{ height: 56, maxWidth: 960, margin: '0 auto' }}>
          <Text size="4" weight="bold">Nimbus</Text>
          <Flex gap="1">
            <Link href="#" size="2" weight="medium">Dashboard</Link>
            <Link href="#" size="2" color="gray">Reports</Link>
            <Link href="#" size="2" color="gray">Settings</Link>
          </Flex>
          <Box flexGrow="1" />
          <Button>New report</Button>
        </Flex>
      </Box>

      <Box px="4" py="6" style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* §2 Buttons */}
        <Box mb="6">
          <SectionLabel>2 · Buttons</SectionLabel>
          <Flex gap="2" wrap="wrap" align="center">
            <Button>Default</Button>
            <Button color="gray">Secondary</Button>
            <Button color="red">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="soft">Soft</Button>
            <Button disabled>Disabled</Button>
          </Flex>
          <Flex gap="2" wrap="wrap" mt="3">
            <Badge>Badge</Badge>
            <Badge color="gray">Secondary</Badge>
            <Badge color="red">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </Flex>
        </Box>

        <Grid columns={{ initial: '1', md: '2' }} gap="6" mb="6">
          {/* §3 Form */}
          <Box>
            <SectionLabel>3 · Form</SectionLabel>
            <Flex direction="column" gap="4" asChild>
              <form>
                <Flex direction="column" gap="1">
                  <Text as="label" size="2" weight="medium" htmlFor="f-name">Project name</Text>
                  <TextField.Root id="f-name" placeholder="e.g. apollo-11" />
                  <Text size="1" color="gray">Lowercase letters and dashes only.</Text>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text as="label" size="2" weight="medium" htmlFor="f-email">Owner email</Text>
                  <TextField.Root id="f-email" defaultValue="not-an-email" color="red" />
                  <Text size="1" color="red">That doesn't look like an email address.</Text>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text as="label" size="2" weight="medium">Region</Text>
                  <Select.Root defaultValue="eu-west">
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="eu-west">eu-west</Select.Item>
                      <Select.Item value="us-east">us-east</Select.Item>
                      <Select.Item value="ap-south">ap-south</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Text as="label" size="2">
                  <Flex gap="2" align="center">
                    <Checkbox id="f-updates" defaultChecked />
                    Email me weekly updates
                  </Flex>
                </Text>
                <RadioGroup.Root defaultValue="starter">
                  <Flex gap="4">
                    <Text as="label" size="2">
                      <Flex gap="2" align="center">
                        <RadioGroup.Item value="starter" /> Starter plan
                      </Flex>
                    </Text>
                    <Text as="label" size="2">
                      <Flex gap="2" align="center">
                        <RadioGroup.Item value="pro" /> Pro plan
                      </Flex>
                    </Text>
                  </Flex>
                </RadioGroup.Root>
                <Text as="label" size="2">
                  <Flex gap="2" align="center">
                    <Switch id="f-alerts" defaultChecked />
                    Enable usage alerts
                  </Flex>
                </Text>
                <Flex gap="2">
                  <Button type="button">Save changes</Button>
                  <Button type="button" variant="outline">Cancel</Button>
                </Flex>
              </form>
            </Flex>
          </Box>

          {/* §4 Card */}
          <Box>
            <SectionLabel>4 · Card</SectionLabel>
            <Card size="3">
              <Heading size="4" mb="1">Q2 growth report</Heading>
              <Text size="2" color="gray">Generated 3 minutes ago</Text>
              <Text as="p" mt="3">
                Revenue grew 18% quarter-over-quarter. The forecast pipeline is refreshed nightly by the{' '}
                <Code>nightly-sync</Code> job; see the <Link href="#">full methodology</Link> for caveats.
              </Text>
              <Flex gap="2" mt="4">
                <Button size="1">Share</Button>
                <Button size="1" variant="outline">Export PDF</Button>
              </Flex>
            </Card>
          </Box>
        </Grid>

        {/* §5 Table */}
        <Box mb="6">
          <SectionLabel>5 · Table</SectionLabel>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Invoice</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Customer</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">Amount</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {invoices.map((row) => (
                <Table.Row key={row.id}>
                  <Table.Cell>
                    <Text weight="medium">{row.id}</Text>
                  </Table.Cell>
                  <Table.Cell>{row.customer}</Table.Cell>
                  <Table.Cell>
                    <Badge color={row.color}>{row.status}</Badge>
                  </Table.Cell>
                  <Table.Cell justify="end">{row.amount}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>

        {/* §6 Modal */}
        <Box mb="6">
          <SectionLabel>6 · Modal</SectionLabel>
          <Dialog.Root>
            <Dialog.Trigger>
              <Button color="red">Delete workspace…</Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Delete workspace?</Dialog.Title>
              <Dialog.Description size="2">
                This permanently deletes <Text weight="bold">nimbus/production</Text> and all its reports. This action
                cannot be undone.
              </Dialog.Description>
              <Flex gap="3" mt="4" justify="end">
                <Dialog.Close>
                  <Button variant="outline">Cancel</Button>
                </Dialog.Close>
                <Dialog.Close>
                  <Button color="red">Delete workspace</Button>
                </Dialog.Close>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        </Box>
      </Box>
    </Theme>
  );
}
