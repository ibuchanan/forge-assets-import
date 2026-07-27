# Tutorial: Complete a first DummyJSON product import

In this tutorial,
we will deploy the reference app,
configure its Product mapping,
and run one import from DummyJSON into Jira Service Management Assets.

## What you will make

You will finish with a Product object type in Assets
populated from the DummyJSON products API
through the Forge Assets Import lifecycle.

## Before you start

Use an Atlassian site
where you can install Forge apps
and create Assets object types.

Install the project dependencies:

```sh
npm install
```

## Create the Product object type

Open Assets in Jira Service Management and create an object type named `Product`.

Add these attributes:

| Attribute   | Type    | Note                       |
| ----------- | ------- | -------------------------- |
| Key         | Text    | Assets has Key by default  |
| Name        | Text    | Assets has Name by default |
| Description | Text    |                            |
| Price       | Double  |                            |
| Category    | Text    |                            |
| Brand       | Text    |                            |
| Rating      | Double  |                            |
| Stock       | Integer |                            |

Set an external ID on each attribute.

Mark `Key` as the object's label or identity attribute.

## Register and deploy the app

When cloned,
this repo has an existing `appId` in the `manifest.yml`.
You don't own that app
so you won't be able to deploy or install it.
You take ownership of app
and get a new `appId` by running `forge register`.
The `package.json` scripts wrap that command as:

```sh
npm run forge:register
```

The npm scripts also wrap `forge deploy` and `forge install`.
Unlike register, those require more information
to know "where" to deploy or install.
That configuration is wrapped by a tool
that helps manage developer secrets,
[secretspec](https://secretspec.dev/).
For now, only safe environment variables are needed
and you can put them in a new `.env` file:

```bash
FORGE_SITE=example.atlassian.net
FORGE_PRODUCT=jira
FORGE_ENVIRONMENT=development
```

With that configuration,
you can deploy the app:

```sh
npm run forge:deploy
```

Install it on your Atlassian site:

```sh
npm run forge:install
```

The app is now available to Assets as `Explore Forge Assets Import`.

## Save the import mapping

Open the Assets import configuration flow for `Explore Forge Assets Import`.

The configuration view shows the field mapping from DummyJSON product fields to Assets Product attributes.

Click `Save configuration`.

You will see a success flag when the mapping is saved.

## Run the import

Start the import from the Assets UI.

The app starts an Assets import execution
and queues the first batch of DummyJSON products.

Wait for the import status to return to ready.

## Check the result

Open the `Product` object type in Assets.

You should see objects with product names, prices, categories, ratings, and stock counts from DummyJSON.

The `Key` value comes from the DummyJSON product ID.
