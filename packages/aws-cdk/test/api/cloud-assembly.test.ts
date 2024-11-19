/* eslint-disable import/order */
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { DefaultSelection } from '../../lib/api/cxapp/cloud-assembly';
import { MockCloudExecutable } from '../util';
import { cliAssemblyWithForcedVersion } from './assembly-versions';

// behave like v2
process.env.CXAPI_DISABLE_SELECT_BY_ID = '1';

test('do not throw when selecting stack without errors', async () => {
  // GIVEN
  const cxasm = await testCloudAssembly();

  // WHEN
  const selected = await cxasm.selectStacks( { patterns: ['withouterrorsNODEPATH'] }, {
    defaultBehavior: DefaultSelection.AllStacks,
  });
  selected.processMetadataMessages();

  // THEN
  expect(selected.firstStack.template.resource).toBe('noerrorresource');
});

test('do throw when selecting stack with errors', async () => {
  // GIVEN
  const cxasm = await testCloudAssembly();

  // WHEN
  const selected = await cxasm.selectStacks({ patterns: ['witherrors'] }, {
    defaultBehavior: DefaultSelection.AllStacks,
  });

  // THEN
  expect(() => selected.processMetadataMessages()).toThrow(/Found errors/);
});

test('select all top level stacks in the presence of nested assemblies', async () => {
  // GIVEN
  const cxasm = await testNestedCloudAssembly();

  // WHEN
  const x = await cxasm.selectStacks({ allTopLevel: true, patterns: [] }, { defaultBehavior: DefaultSelection.AllStacks });

  // THEN
  expect(x.stackCount).toBe(2);
  expect(x.stackIds).toContain('witherrors');
  expect(x.stackIds).toContain('withouterrors');
});

test('select stacks by glob pattern', async () => {
  // GIVEN
  const cxasm = await testCloudAssembly();

  // WHEN
  const x = await cxasm.selectStacks({ patterns: ['with*'] }, { defaultBehavior: DefaultSelection.AllStacks });

  // THEN
  expect(x.stackCount).toBe(2);
  expect(x.stackIds).toContain('witherrors');
  expect(x.stackIds).toContain('withouterrors');
});

test('select behavior: all', async () => {
  // GIVEN
  const cxasm = await testCloudAssembly();

  // WHEN
  const x = await cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.AllStacks });

  // THEN
  expect(x.stackCount).toBe(2);
});

test('select behavior: none', async () => {
  // GIVEN
  const cxasm = await testCloudAssembly();

  // WHEN
  const x = await cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.None });

  // THEN
  expect(x.stackCount).toBe(0);
});

test('select behavior: single', async () => {
  // GIVEN
  const cxasm = await testCloudAssembly();

  // WHEN
  await expect(cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.OnlySingle }))
    .rejects.toThrow('Since this app includes more than a single stack, specify which stacks to use (wildcards are supported) or specify `--all`');
});

test('stack list error contains node paths', async () => {
  // GIVEN
  const cxasm = await testCloudAssembly();

  // WHEN
  await expect(cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.OnlySingle }))
    .rejects.toThrow('withouterrorsNODEPATH');
});

test('select behavior: repeat', async () => {
  // GIVEN
  const cxasm = await testCloudAssembly();

  // WHEN
  const x = await cxasm.selectStacks({ patterns: ['withouterrorsNODEPATH', 'withouterrorsNODEPATH'] }, {
    defaultBehavior: DefaultSelection.AllStacks,
  });

  // THEN
  expect(x.stackCount).toBe(1);
});

test('select behavior with nested assemblies: all', async () => {
  // GIVEN
  const cxasm = await testNestedCloudAssembly();

  // WHEN
  const x = await cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.AllStacks });

  // THEN
  expect(x.stackCount).toBe(3);
});

test('select behavior with nested assemblies: none', async () => {
  // GIVEN
  const cxasm = await testNestedCloudAssembly();

  // WHEN
  const x = await cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.None });

  // THEN
  expect(x.stackCount).toBe(0);
});

test('select behavior with nested assemblies: single', async () => {
  // GIVEN
  const cxasm = await testNestedCloudAssembly();

  // WHEN
  await expect(cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.OnlySingle }))
    .rejects.toThrow('Since this app includes more than a single stack, specify which stacks to use (wildcards are supported) or specify `--all`');
});

test('select behavior with nested assemblies: repeat', async() => {
  // GIVEN
  const cxasm = await testNestedCloudAssembly();

  // WHEN
  const x = await cxasm.selectStacks({ patterns: ['deeply/hidden/withouterrors', 'nested'] }, {
    defaultBehavior: DefaultSelection.AllStacks,
  });

  // THEN
  expect(x.stackCount).toBe(2);
});

test('select behavior with no stacks and ignore stacks option', async() => {
  // GIVEN
  const cxasm = await testCloudAssemblyNoStacks();

  // WHEN
  const x = await cxasm.selectStacks({ patterns: [] }, {
    defaultBehavior: DefaultSelection.AllStacks,
    ignoreNoStacks: true,
  });

  // THEN
  expect(x.stackCount).toBe(0);
});

test('select behavior with no stacks and no ignore stacks option', async() => {
  // GIVEN
  const cxasm = await testCloudAssemblyNoStacks();

  // WHEN & THEN
  await expect(cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.AllStacks, ignoreNoStacks: false }))
    .rejects.toThrow('This app contains no stacks');
});

test('select behavior with no stacks and default ignore stacks options (false)', async() => {
  // GIVEN
  const cxasm = await testCloudAssemblyNoStacks();

  // WHEN & THEN
  await expect(cxasm.selectStacks({ patterns: [] }, { defaultBehavior: DefaultSelection.AllStacks }))
    .rejects.toThrow('This app contains no stacks');
});

async function testCloudAssembly({ env }: { env?: string; versionReporting?: boolean } = {}) {
  const cloudExec = new MockCloudExecutable({
    stacks: [{
      stackName: 'withouterrors',
      displayName: 'withouterrorsNODEPATH',
      env,
      template: { resource: 'noerrorresource' },
    },
    {
      stackName: 'witherrors',
      env,
      template: { resource: 'errorresource' },
      metadata: {
        '/resource': [
          {
            type: cxschema.ArtifactMetadataEntryType.ERROR,
            data: 'this is an error',
          },
        ],
      },
    }],
  });

  return cloudExec.synthesize();
}

async function testCloudAssemblyNoStacks() {
  const cloudExec = new MockCloudExecutable({
    stacks: [],
  });

  return cloudExec.synthesize();
}

async function testNestedCloudAssembly({ env }: { env?: string; versionReporting?: boolean } = {}) {
  const cloudExec = new MockCloudExecutable({
    stacks: [{
      stackName: 'withouterrors',
      env,
      template: { resource: 'noerrorresource' },
      // The nesting in the path should be independent of the position in the tree
      displayName: 'deeply/hidden/withouterrors',
    },
    {
      stackName: 'witherrors',
      env,
      template: { resource: 'errorresource' },
      metadata: {
        '/resource': [
          {
            type: cxschema.ArtifactMetadataEntryType.ERROR,
            data: 'this is an error',
          },
        ],
      },
    }],
    nestedAssemblies: [{
      stacks: [{
        stackName: 'nested',
        env,
        template: { resource: 'nestederror' },
        metadata: {
          '/resource': [
            {
              type: cxschema.ArtifactMetadataEntryType.ERROR,
              data: 'this is another error',
            },
          ],
        },
      }],
    }],
  });

  const asm = await cloudExec.synthesize();
  return cliAssemblyWithForcedVersion(asm, '30.0.0');
}
