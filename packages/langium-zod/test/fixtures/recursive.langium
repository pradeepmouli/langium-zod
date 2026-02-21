grammar Recursive

entry Model:
	nodes+=TreeNode*;

TreeNode:
	'tree' name=ID ('children' children+=TreeNode*)?;

A:
	'b' b=B;

B:
	'a' a=A;

terminal ID: /[_a-zA-Z][_a-zA-Z0-9]*/;
