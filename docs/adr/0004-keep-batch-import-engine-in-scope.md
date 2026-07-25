# Keep batch import engine in scope

The reference app should keep a batch import engine in the modernization scope, but place it after the local Assets client, mapping contract, and lifecycle baseline. Even though DummyJSON is artificial, Forge Assets imports commonly need to process many objects, and Atlassian's async events Assets import guidance recommends chunking work through queues to avoid invocation limits. Keeping this pattern visible is part of the reference app's teaching value.
