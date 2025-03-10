import { useFormik } from 'formik';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import { useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as yup from 'yup';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Alert,
  Box,
  Drawer,
  IconButton,
  SelectChangeEvent,
  Stack,
  Typography
} from '@mui/material';

import SelectInput from 'components/organisms/inputs/selectInput';

import { ILLMSettings } from 'state/chat';
import { ILLMProvider, playgroundState } from 'state/playground';

import FormInput, { TFormInput, TFormInputValue } from '../FormInput';
import { getProviders } from './helpers';

type Schema = {
  [key: string]: yup.Schema;
};

interface IFormProps {
  settings: ILLMSettings;
  schema: Schema;
}

const SettingsForm = ({ settings, schema }: IFormProps) => {
  const [playground, setPlayground] = useRecoilState(playgroundState);
  const { provider, providers, providerFound } = getProviders(playground);

  const providerWarning = !providerFound ? (
    <Alert severity="warning">
      {playground.prompt?.provider
        ? `${playground?.prompt?.provider} provider is not found, using 
      ${provider.name} instead.`
        : `Provider not specified, using ${provider.name} instead.`}
    </Alert>
  ) : null;

  const formik = useFormik({
    initialValues: settings,
    validationSchema: schema,
    enableReinitialize: true,
    onSubmit: async () => undefined
  });

  useEffect(() => {
    setPlayground((old) => ({
      ...old,
      prompt: {
        ...old.prompt!,
        settings: formik.values
      }
    }));
  }, [formik.values]);

  const onSelectedProviderChange = (event: SelectChangeEvent) => {
    setPlayground((old) =>
      merge(cloneDeep(old), {
        prompt: {
          provider: event.target.value
        }
      })
    );
  };

  const buildProviderTooltip = () => {
    if (provider.is_chat && !playground.prompt?.messages) {
      return `${provider.name} is message-based. This prompt will be wrapped in a message before being sent to ${provider.name}.`;
    } else if (!provider.is_chat && playground.prompt?.messages) {
      return `${provider.name} is prompt-based. The messages will converted to a single prompt before being sent to ${provider.name}.`;
    } else {
      return undefined;
    }
  };

  return (
    <Box width={250} sx={{ height: 'inherit' }}>
      <Typography fontSize="16px" fontWeight={600} color="text.primary">
        Settings
      </Typography>
      <Stack
        spacing={2}
        sx={{
          overflowY: 'auto',
          overflowX: 'hidden',
          height: '100%'
        }}
      >
        <SelectInput
          items={providers?.map((provider: ILLMProvider) => ({
            label: provider.name,
            value: provider.id
          }))}
          id="llm-providers"
          value={provider.id}
          label="LLM Provider"
          tooltip={buildProviderTooltip()}
          onChange={onSelectedProviderChange}
        />
        {providerWarning}
        {provider.inputs.map((input: TFormInput, index: number) => (
          <Box
            // This trick is to have padding at the end of the scroll
            sx={{ paddingBottom: index === provider.inputs.length - 1 ? 2 : 0 }}
          >
            <FormInput
              key={input.id}
              element={{
                ...input,
                id: input.id,
                value: formik.values[input.id] as any,
                onChange: (event: any): void => {
                  formik.handleChange(event);
                },
                setField: (
                  field: string,
                  value: TFormInputValue,
                  shouldValidate?: boolean
                ): void => {
                  formik.setFieldValue(field, value, shouldValidate);
                }
              }}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

const ModelSettings = () => {
  const playground = useRecoilValue(playgroundState);

  const { provider } = getProviders(playground);

  if (!provider) {
    return null;
  }

  const settings: ILLMSettings = {};
  const currentSettings = playground?.prompt?.settings || {};
  const origSettings = playground?.originalPrompt?.settings || {};

  const isSettingCompatible = (
    value: string | number | boolean | string[],
    input: TFormInput
  ) => {
    if (input.type === 'select') {
      return !!input?.items?.find((i) => i.value === value);
    }
    return true;
  };

  const schema = yup.object(
    provider.inputs.reduce((object: Schema, input: TFormInput) => {
      const settingValue =
        currentSettings[input.id] !== undefined
          ? currentSettings[input.id]
          : origSettings[input.id];

      if (
        settingValue !== undefined &&
        isSettingCompatible(settingValue, input)
      ) {
        settings[input.id] = settingValue;
      } else if (input.initial !== undefined) {
        settings[input.id] = input.initial;
      }

      switch (input.type) {
        case 'select':
          object[input.id] = yup.string();
          break;
        case 'slider': {
          let schema = yup.number();
          if (input.min) {
            schema = schema.min(input.min);
          }
          if (input.max) {
            schema = schema.max(input.max);
          }
          object[input.id] = schema;
          break;
        }
        case 'tags':
          object[input.id] = yup.array().of(yup.string());
          break;
      }

      return object;
    }, {})
  );

  return (
    <SettingsForm schema={schema as unknown as Schema} settings={settings} />
  );
};

interface Props {
  isSmallScreen: boolean;
  isDrawerOpen: boolean;
  toggleDrawer: () => void;
}

export default function ResponsiveModelSettings({
  isSmallScreen,
  isDrawerOpen,
  toggleDrawer
}: Props) {
  return !isSmallScreen ? (
    <Box ml="32px !important" height="100%">
      <ModelSettings />
    </Box>
  ) : (
    <Drawer
      sx={{
        '& .MuiDrawer-paper': {}
      }}
      variant="persistent"
      anchor="right"
      open={isDrawerOpen}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          pt: 2,
          pr: 1
        }}
      >
        <IconButton onClick={toggleDrawer}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
      <Box px={3}>
        <ModelSettings />
      </Box>
    </Drawer>
  );
}
