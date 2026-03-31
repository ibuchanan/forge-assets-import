import { type FullContext, invoke, showFlag, view } from "@forge/bridge";
import ForgeReconciler, {
  Button,
  DynamicTable,
  Form,
  FormFooter,
  FormSection,
  Heading,
  SectionMessage,
  Spinner,
  Stack,
  Text,
} from "@forge/react";
import React, { useEffect, useState } from "react";

interface AssetsImportExtension {
  workspaceId: string;
  importId: string;
  schemaId: string;
}

export const submitAssetMapping = async (
  extension: AssetsImportExtension,
  mapping: {
    mapping: {
      objectTypeMappings: Array<{
        objectTypeExternalId: string;
        objectTypeName: string;
        selector: string;
        attributesMapping: Array<{
          attributeExternalId: string;
          attributeName: string;
          attributeLocators: string[];
          externalIdPart?: boolean;
        }>;
      }>;
    };
  },
): Promise<void> => {
  const { workspaceId, importId } = extension;

  const result = await invoke<{
    success: boolean;
    error?: { detail?: string };
  }>("submitMapping", {
    workspaceId,
    importId,
    mapping,
  });

  if (!result.success) {
    throw new Error(
      result.error?.detail || "Failed to submit mapping configuration",
    );
  }
};

export const App = () => {
  const [context, setContext] = useState<FullContext | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!context) {
      void view.getContext().then(setContext);
    }
  }, [context]);

  const handleSubmit = async (): Promise<void> => {
    const extension = context?.extension as AssetsImportExtension | undefined;
    if (!extension) {
      throw new Error("Context or extension not available");
    }

    setIsLoading(true);

    try {
      // Build the mapping by calling backend resolver
      // This allows proper logging and debugging of Assets API responses
      const mappingResult = await invoke<{
        success: boolean;
        data?: unknown;
        error?: { detail?: string };
      }>("buildMapping", {
        workspaceId: extension.workspaceId,
        importId: extension.importId,
      });

      if (!mappingResult.success || !mappingResult.data) {
        // Handle error without throwing - show error flag directly
        showFlag({
          id: "mapping-error",
          title: "Error",
          type: "error",
          description:
            mappingResult.error?.detail ||
            "Failed to build mapping configuration",
        });
        return;
      }

      // Submit the mapping to Assets Import API
      await submitAssetMapping(
        extension,
        mappingResult.data as Parameters<typeof submitAssetMapping>[1],
      );

      showFlag({
        id: "mapping-success",
        title: "Success",
        type: "success",
        description: "Mapping configuration saved successfully",
      });
    } catch (error) {
      // Error details are already logged by backend resolver
      showFlag({
        id: "mapping-error",
        title: "Error",
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save mapping configuration",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!context) {
    return <Spinner />;
  }

  // Define the field mappings for display
  const fieldMappings = [
    {
      dummyJson: "id",
      assets: "Key",
      type: "Integer",
      description: "Unique product identifier (used as external ID)",
    },
    {
      dummyJson: "title",
      assets: "Name",
      type: "Text",
      description: "Product name/title",
    },
    {
      dummyJson: "description",
      assets: "Description",
      type: "Textarea",
      description: "Detailed product description",
    },
    {
      dummyJson: "price",
      assets: "Price",
      type: "Float",
      description: "Product price in USD",
    },
    {
      dummyJson: "category",
      assets: "Category",
      type: "Text",
      description: "Product category",
    },
    {
      dummyJson: "brand",
      assets: "Brand",
      type: "Text",
      description: "Product brand/manufacturer",
    },
    {
      dummyJson: "rating",
      assets: "Rating",
      type: "Integer",
      description: "Product rating (0-5)",
    },
    {
      dummyJson: "stock",
      assets: "Stock",
      type: "Integer",
      description: "Available stock quantity",
    },
  ];

  const tableHead = {
    cells: [
      { key: "dummyJson", content: "DummyJSON Field" },
      { key: "assets", content: "Assets Attribute" },
      { key: "type", content: "Type" },
      { key: "description", content: "Description" },
    ],
  };

  const tableRows = fieldMappings.map((mapping, index) => ({
    key: `mapping-${index}`,
    cells: [
      { key: "dummyJson", content: mapping.dummyJson },
      { key: "assets", content: mapping.assets },
      { key: "type", content: mapping.type },
      { key: "description", content: mapping.description },
    ],
  }));

  return (
    <Form onSubmit={handleSubmit}>
      <FormSection>
        <Stack space="space.200">
          <Heading size="medium">
            DummyJSON Products Import Configuration
          </Heading>

          <SectionMessage appearance="information">
            <Text>
              This import will automatically map product data from the DummyJSON
              API to your Assets object type. The mapping below shows how each
              field will be imported.
            </Text>
          </SectionMessage>

          <Stack space="space.100">
            <Heading size="small">Field Mapping</Heading>
            <Text>
              The following fields will be mapped when importing products:
            </Text>
          </Stack>

          <DynamicTable head={tableHead} rows={tableRows} />

          <SectionMessage appearance="success">
            <Text>
              Click "Save configuration" to confirm this mapping. The import
              will use the Products object type with Sentence case attribute
              names (Name, Description, Price, etc.).
            </Text>
          </SectionMessage>
        </Stack>
      </FormSection>
      <FormFooter>
        <Button appearance="primary" type="submit" isDisabled={isLoading}>
          {isLoading ? "Saving..." : "Save configuration"}
        </Button>
      </FormFooter>
    </Form>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
