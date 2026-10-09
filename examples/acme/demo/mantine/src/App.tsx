import { useState } from 'react';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Code,
  Container,
  Group,
  Modal,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import ds from './ds.config';

// Every colour here is a role name: the compiled theme registers each role as
// a Mantine virtual colour, so `color="danger"` is the design system's danger.
const invoices = [
  { id: '#1042', customer: 'Globex', status: 'Paid', color: 'success', amount: '$1,250.00' },
  { id: '#1043', customer: 'Initech', status: 'Pending', color: 'warning', amount: '$840.50' },
  { id: '#1044', customer: 'Umbrella', status: 'Overdue', color: 'danger', amount: '$2,310.00' },
  { id: '#1045', customer: 'Hooli', status: 'Draft', color: 'neutral', amount: '$675.25' },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Title order={2} fz="xs" c="dimmed" tt="uppercase" mb="sm" style={{ letterSpacing: '0.08em' }}>
      {children}
    </Title>
  );
}

export default function App() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const [deleting, setDeleting] = useState(false);

  return (
    <Box mih="100vh" bg="var(--mantine-color-body)">
      {/* demo chrome (not part of the fake app) */}
      <Group gap="sm" px="md" py={6} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Text fw={700}>transtyle demo · {ds.label}</Text>
        <Text c="dimmed" size="sm">
          @mantine/core — real components, themed by the compiled createTheme + cssVariablesResolver
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Button variant="default" size="compact-sm" onClick={() => setColorScheme(mode === 'dark' ? 'light' : 'dark')}>
          {mode === 'dark' ? '☀ light' : '☾ dark'}
        </Button>
      </Group>

      {/* §1 Header */}
      <Box style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Container size={960} h={56}>
          <Group h="100%" gap="lg">
            <Text size="lg" fw={700}>
              Nimbus
            </Text>
            <Group gap="sm">
              <Anchor href="#" size="sm" fw={500}>
                Dashboard
              </Anchor>
              <Anchor href="#" size="sm" c="dimmed">
                Reports
              </Anchor>
              <Anchor href="#" size="sm" c="dimmed">
                Settings
              </Anchor>
            </Group>
            <Box style={{ flexGrow: 1 }} />
            <Button>New report</Button>
          </Group>
        </Container>
      </Box>

      <Container size={960} py="xl">
        {/* §2 Buttons */}
        <Box mb="xl">
          <SectionLabel>2 · Buttons</SectionLabel>
          <Group gap="xs">
            <Button>Default</Button>
            <Button color="secondary">Secondary</Button>
            <Button color="danger">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="subtle">Ghost</Button>
            <Button variant="light">Soft</Button>
            <Button disabled>Disabled</Button>
          </Group>
          <Group gap="xs" mt="sm">
            <Badge>Badge</Badge>
            <Badge color="secondary">Secondary</Badge>
            <Badge color="danger">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </Group>
        </Box>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
          {/* §3 Form */}
          <Box>
            <SectionLabel>3 · Form</SectionLabel>
            <Stack gap="md" component="form">
              <TextInput label="Project name" placeholder="e.g. apollo-11" description="Lowercase letters and dashes only." inputWrapperOrder={['label', 'input', 'description']} />
              <TextInput label="Owner email" defaultValue="not-an-email" error="That doesn't look like an email address." />
              <Select label="Region" defaultValue="eu-west" data={['eu-west', 'us-east', 'ap-south']} allowDeselect={false} />
              <Checkbox label="Email me weekly updates" defaultChecked />
              <Radio.Group defaultValue="starter">
                <Group gap="lg">
                  <Radio value="starter" label="Starter plan" />
                  <Radio value="pro" label="Pro plan" />
                </Group>
              </Radio.Group>
              <Switch label="Enable usage alerts" defaultChecked />
              <Group gap="xs">
                <Button type="button">Save changes</Button>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Group>
            </Stack>
          </Box>

          {/* §4 Card */}
          <Box>
            <SectionLabel>4 · Card</SectionLabel>
            <Card withBorder shadow="xs" padding="lg">
              <Title order={3}>Q2 growth report</Title>
              <Text size="sm" c="dimmed">
                Generated 3 minutes ago
              </Text>
              <Text mt="sm">
                Revenue grew 18% quarter-over-quarter. The forecast pipeline is refreshed nightly by the{' '}
                <Code>nightly-sync</Code> job; see the <Anchor href="#">full methodology</Anchor> for caveats.
              </Text>
              <Group gap="xs" mt="md">
                <Button size="xs">Share</Button>
                <Button size="xs" variant="outline">
                  Export PDF
                </Button>
              </Group>
            </Card>
          </Box>
        </SimpleGrid>

        {/* §5 Table */}
        <Box mb="xl">
          <SectionLabel>5 · Table</SectionLabel>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invoices.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td fw={500}>{row.id}</Table.Td>
                  <Table.Td>{row.customer}</Table.Td>
                  <Table.Td>
                    <Badge color={row.color} variant="light">
                      {row.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">{row.amount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>

        {/* §6 Modal */}
        <Box mb="xl">
          <SectionLabel>6 · Modal</SectionLabel>
          <Button color="danger" onClick={() => setDeleting(true)}>
            Delete workspace…
          </Button>
          <Modal opened={deleting} onClose={() => setDeleting(false)} title="Delete workspace?" centered>
            <Text size="sm">
              This permanently deletes <b>nimbus/production</b> and all its reports. This action cannot be undone.
            </Text>
            <Group gap="sm" mt="md" justify="flex-end">
              <Button variant="outline" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button color="danger" onClick={() => setDeleting(false)}>
                Delete workspace
              </Button>
            </Group>
          </Modal>
        </Box>
      </Container>
    </Box>
  );
}
